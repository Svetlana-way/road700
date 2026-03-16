import Foundation
import ImageIO
import Vision

struct OCRPayload: Codable {
    let path: String
    let text: String
}

struct OCRResponse: Codable {
    let backend: String
    let results: [OCRPayload]
}

enum OCRScriptError: Error {
    case missingArgument
}

let customWords = [
    "Заказ-наряд",
    "Госномер",
    "Пробег",
    "Сервис",
    "Запчасти",
    "Стоимость",
    "Итого",
    "НДС",
    "VIN",
    "OCR",
]

func isCyrillic(_ scalar: UnicodeScalar) -> Bool {
    return (0x0400...0x04FF).contains(scalar.value) || (0x0500...0x052F).contains(scalar.value)
}

func isAsciiLetter(_ scalar: UnicodeScalar) -> Bool {
    return (0x41...0x5A).contains(scalar.value) || (0x61...0x7A).contains(scalar.value)
}

func scoreText(_ text: String) -> Int {
    let lowered = text.lowercased()
    let keywords = ["заказ", "наряд", "дата", "госномер", "пробег", "работ", "запчаст", "итого", "сервис", "ндс"]

    var keywordHits = 0
    for keyword in keywords {
        keywordHits += lowered.components(separatedBy: keyword).count - 1
    }

    var alnumCount = 0
    var cyrillicCount = 0
    var noisySymbols = 0
    var foreignLetterPenalty = 0

    for scalar in text.unicodeScalars {
        if CharacterSet.alphanumerics.contains(scalar) {
            alnumCount += 1
        }
        if isCyrillic(scalar) {
            cyrillicCount += 1
        }
        if "•~_|`".unicodeScalars.contains(scalar) {
            noisySymbols += 1
        }
        if CharacterSet.letters.contains(scalar) && !isCyrillic(scalar) && !isAsciiLetter(scalar) {
            foreignLetterPenalty += 1
        }
        if !CharacterSet.alphanumerics.contains(scalar)
            && !CharacterSet.whitespacesAndNewlines.contains(scalar)
            && !"-/.,:№#()\"'".unicodeScalars.contains(scalar)
        {
            noisySymbols += 1
        }
    }

    return keywordHits * 1000 + cyrillicCount * 15 + alnumCount - noisySymbols * 5 - foreignLetterPenalty * 20
}

func bestCandidateText(for observation: VNRecognizedTextObservation) -> String? {
    let candidates = observation.topCandidates(3)
    guard let best = candidates.max(by: { scoreText($0.string) < scoreText($1.string) }) else {
        return nil
    }
    return best.string
}

func recognizeVariant(
    cgImage: CGImage,
    level: VNRequestTextRecognitionLevel,
    usesLanguageCorrection: Bool
) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = level
    request.usesLanguageCorrection = usesLanguageCorrection
    request.recognitionLanguages = ["ru-RU", "en-US"]
    request.customWords = customWords

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    let text = observations
        .compactMap(bestCandidateText)
        .joined(separator: "\n")
        .trimmingCharacters(in: .whitespacesAndNewlines)

    return text
}

func recognizeText(at imagePath: String) throws -> OCRPayload {
    let imageURL = URL(fileURLWithPath: imagePath)
    guard
        let imageSource = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
        let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
    else {
        throw NSError(domain: "Road700OCR", code: 10, userInfo: [NSLocalizedDescriptionKey: "Cannot open image"])
    }

    let variants: [(VNRequestTextRecognitionLevel, Bool)] = [
        (.accurate, true),
        (.accurate, false),
        (.fast, true),
        (.fast, false),
    ]
    let texts = try variants.map { level, usesLanguageCorrection in
        try recognizeVariant(
            cgImage: cgImage,
            level: level,
            usesLanguageCorrection: usesLanguageCorrection
        )
    }
    let bestText = texts.max(by: { scoreText($0) < scoreText($1) }) ?? ""

    return OCRPayload(path: imagePath, text: bestText)
}

func main() throws {
    let arguments = Array(CommandLine.arguments.dropFirst())
    if arguments.isEmpty {
        throw OCRScriptError.missingArgument
    }

    let results = try arguments.map { try recognizeText(at: $0) }
    let response = OCRResponse(backend: "apple_vision", results: results)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.withoutEscapingSlashes]
    let data = try encoder.encode(response)
    FileHandle.standardOutput.write(data)
}

do {
    try main()
} catch {
    let message = String(describing: error)
    FileHandle.standardError.write(Data(message.utf8))
    exit(1)
}
