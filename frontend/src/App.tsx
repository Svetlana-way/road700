import { Box, Chip, Container, Grid, Paper, Stack, Typography } from "@mui/material";

const cards = [
  {
    title: "Fleet registry",
    text: "Truck and trailer imports, assignments, statuses, and vehicle history.",
  },
  {
    title: "Document pipeline",
    text: "PDF and photo upload, OCR, review queue, and versioned source documents.",
  },
  {
    title: "Repair control",
    text: "Drafts, verification flow, suspicious flags, and approval by employee and admin.",
  },
  {
    title: "Analytics",
    text: "Dashboards for costs, services, suspicious repairs, and data quality.",
  },
];

export default function App() {
  return (
    <Box className="app-shell">
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Box className="hero">
            <Chip label="Road700 MVP scaffold" color="primary" />
            <Typography variant="h2" component="h1">
              Fleet repairs platform
            </Typography>
            <Typography className="hero-copy">
              React and FastAPI scaffold prepared for the repair history, OCR review,
              analytics, and data quality workflows agreed in the requirements log.
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {cards.map((card) => (
              <Grid item xs={12} md={6} key={card.title}>
                <Paper className="card" elevation={0}>
                  <Typography variant="h5">{card.title}</Typography>
                  <Typography className="card-copy">{card.text}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper className="status-panel" elevation={0}>
            <Typography variant="h6">Next implementation slice</Typography>
            <Typography className="card-copy">
              Authentication, vehicle import, document upload, OCR review screen, and the
              first repair draft flow.
            </Typography>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}

