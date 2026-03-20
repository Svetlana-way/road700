import { type ComponentProps } from "react";
import { Grid, Stack } from "@mui/material";
import { DocumentsListPanel } from "./DocumentsListPanel";
import { DocumentsUploadPanel } from "./DocumentsUploadPanel";
import { ReviewQueuePanel } from "./ReviewQueuePanel";

type DocumentsUploadPanelProps = ComponentProps<typeof DocumentsUploadPanel>;
type ReviewQueuePanelProps = ComponentProps<typeof ReviewQueuePanel>;
type DocumentsListPanelProps = ComponentProps<typeof DocumentsListPanel>;

type WorkspaceDocumentsPanelProps = {
  active: boolean;
  uploadProps: DocumentsUploadPanelProps;
  reviewQueueProps: ReviewQueuePanelProps;
  documentsListProps: DocumentsListPanelProps;
};

export function WorkspaceDocumentsPanel({
  active,
  uploadProps,
  reviewQueueProps,
  documentsListProps,
}: WorkspaceDocumentsPanelProps) {
  return (
    <>
      {active ? <DocumentsUploadPanel {...uploadProps} /> : null}

      <Grid item xs={12} md={active ? 5 : 12}>
        <Stack spacing={3}>
          {active ? <ReviewQueuePanel {...reviewQueueProps} /> : null}
          {active ? <DocumentsListPanel {...documentsListProps} /> : null}
        </Stack>
      </Grid>
    </>
  );
}
