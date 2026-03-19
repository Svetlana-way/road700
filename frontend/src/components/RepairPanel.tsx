import type { ReactNode } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";

type RepairPanelProps = {
  returnLabel: string | null;
  onReturn: (() => void) | null;
  children: ReactNode;
};

export function RepairPanel({ returnLabel, onReturn, children }: RepairPanelProps) {
  return (
    <Box sx={{ width: "100%", maxWidth: 1120, mx: "auto" }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          {returnLabel && onReturn ? (
            <Button variant="text" onClick={onReturn}>
              {returnLabel}
            </Button>
          ) : (
            <Box />
          )}
          <Typography className="muted-copy">
            Отчёт открыт отдельной страницей и выведен по центру экрана.
          </Typography>
        </Stack>
        <Paper className="workspace-panel" elevation={0}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h5">Карточка ремонта</Typography>
              <Typography className="muted-copy">
                Сначала короткий вывод для руководителя, затем полная расшифровка проверки по кнопке и все рабочие детали ремонта.
              </Typography>
            </Box>
            {children}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
