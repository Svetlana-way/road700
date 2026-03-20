import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";

const HISTORY_DETAIL_PREVIEW_LIMIT = 220;
const HISTORY_DETAIL_PREVIEW_LINES = 3;

type HistoryDetailsPreviewProps = {
  lines: string[];
};

export function HistoryDetailsPreview({ lines }: HistoryDetailsPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const text = lines.join("\n");
  const previewLines = lines.slice(-HISTORY_DETAIL_PREVIEW_LINES);
  const previewText = previewLines.join("\n");
  const isExpandable = text.length > HISTORY_DETAIL_PREVIEW_LIMIT || lines.length > HISTORY_DETAIL_PREVIEW_LINES;
  const visibleText =
    !isExpandable || isExpanded
      ? text
      : previewText.length > HISTORY_DETAIL_PREVIEW_LIMIT
        ? `${previewText.slice(0, HISTORY_DETAIL_PREVIEW_LIMIT).trimEnd()}...`
        : previewText;

  return (
    <Stack spacing={0.5}>
      <Typography className="muted-copy" sx={{ whiteSpace: "pre-line" }}>
        {visibleText}
      </Typography>
      {isExpandable ? (
        <Box>
          <Button size="small" onClick={() => setIsExpanded((current) => !current)}>
            {isExpanded ? "Скрыть" : "Подробнее"}
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}
