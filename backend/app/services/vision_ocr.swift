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

func recognizeText(at imagePath: String) throws -> OCRPayload {
    let imageURL = URL(fileURLWithPath: imagePath)
    guard
        let imageSource = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
        let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
    else {
        throw NSError(domain: "Road700OCR", code: 10, userInfo: [NSLocalizedDescriptionKey: "Cannot open image"])
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["ru-RU", "en-US"]

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    let text = observations
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n")

    return OCRPayload(path: imagePath, text: text)
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
