import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type UserRole = "admin" | "employee";
type VehicleType = "truck" | "trailer";
type DocumentStatus =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";

type DashboardSummary = {
  vehicles_total: number;
  repairs_total: number;
  repairs_draft: number;
  repairs_suspicious: number;
  documents_total: number;
  documents_review_queue: number;
};

type User = {
  id: number;
  full_name: string;
  login: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

type Vehicle = {
  id: number;
  vehicle_type: VehicleType;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
  current_driver_name: string | null;
};

type VehiclesResponse = {
  items: Vehicle[];
  total: number;
};

type DocumentItem = {
  id: number;
  original_filename: string;
  source_type: string;
  status: DocumentStatus;
  created_at: string;
  notes: string | null;
  repair: {
    id: number;
    order_number: string | null;
    repair_date: string;
    mileage: number;
    status: string;
  };
  vehicle: {
    id: number;
    vehicle_type: VehicleType;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
};

type DocumentsResponse = {
  items: DocumentItem[];
};

type LoginResponse = {
  access_token: string;
};

type UploadFormState = {
  vehicleId: string;
  repairDate: string;
  mileage: string;
  orderNumber: string;
  reason: string;
  employeeComment: string;
  notes: string;
};

const TOKEN_STORAGE_KEY = "road700.access_token";
const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/api"
    : "/api";

const emptyUploadForm = (): UploadFormState => ({
  vehicleId: "",
  repairDate: new Date().toISOString().slice(0, 10),
  mileage: "",
  orderNumber: "",
  reason: "",
  employeeComment: "",
  notes: "",
});

const summaryCards: Array<{ key: keyof DashboardSummary; label: string }> = [
  { key: "vehicles_total", label: "Техника в доступе" },
  { key: "repairs_total", label: "Ремонтов в базе" },
  { key: "documents_total", label: "Документов загружено" },
  { key: "documents_review_queue", label: "Очередь проверки" },
];

function formatStatus(status: string) {
  return status.split("_").join(" ");
}

function formatVehicle(vehicle: Vehicle | DocumentItem["vehicle"]) {
  const parts = [vehicle.plate_number, vehicle.brand, vehicle.model].filter(Boolean);
  return parts.join(" • ") || `#${vehicle.id}`;
}

function statusColor(status: DocumentStatus): "default" | "success" | "error" | "warning" {
  if (status === "confirmed" || status === "recognized") {
    return "success";
  }
  if (status === "ocr_error") {
    return "error";
  }
  if (status === "needs_review" || status === "partially_recognized") {
    return "warning";
  }
  return "default";
}

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || "");
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loginValue, setLoginValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [uploadForm, setUploadForm] = useState<UploadFormState>(emptyUploadForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bootLoading, setBootLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadWorkspace(activeToken: string) {
    setBootLoading(true);
    try {
      const [me, dashboard, vehicleList, recentDocuments] = await Promise.all([
        apiRequest<User>("/auth/me", { method: "GET" }, activeToken),
        apiRequest<DashboardSummary>("/dashboard/summary", { method: "GET" }, activeToken),
        apiRequest<VehiclesResponse>("/vehicles?limit=200", { method: "GET" }, activeToken),
        apiRequest<DocumentsResponse>("/documents?limit=8", { method: "GET" }, activeToken),
      ]);

      setUser(me);
      setSummary(dashboard);
      setVehicles(vehicleList.items);
      setDocuments(recentDocuments.items);
      setErrorMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load workspace";
      setErrorMessage(message);
      if (message.toLowerCase().includes("validate credentials")) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken("");
        setUser(null);
      }
    } finally {
      setBootLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setUser(null);
      setSummary(null);
      setVehicles([]);
      setDocuments([]);
      return;
    }
    void loadWorkspace(token);
  }, [token]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const body = new URLSearchParams();
      body.set("username", loginValue);
      body.set("password", passwordValue);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail || "Login failed");
      }

      const payload = (await response.json()) as LoginResponse;
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.access_token);
      setToken(payload.access_token);
      setPasswordValue("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedFile) {
      setErrorMessage("Select a file before uploading");
      return;
    }

    setUploadLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const body = new FormData();
      body.append("vehicle_id", uploadForm.vehicleId);
      body.append("repair_date", uploadForm.repairDate);
      body.append("mileage", uploadForm.mileage);
      body.append("order_number", uploadForm.orderNumber);
      body.append("reason", uploadForm.reason);
      body.append("employee_comment", uploadForm.employeeComment);
      body.append("notes", uploadForm.notes);
      body.append("file", selectedFile);

      const result = await apiRequest<{ message: string }>("/documents/upload", {
        method: "POST",
        body,
      }, token);

      setSuccessMessage(result.message);
      setUploadForm(emptyUploadForm());
      setSelectedFile(null);
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
    setSuccessMessage("");
    setErrorMessage("");
  }

  if (!token) {
    return (
      <Box className="app-shell">
        <Container maxWidth="md">
          <Paper className="hero-panel" elevation={0}>
            <Stack spacing={3}>
              <Box>
                <Chip label="Road700" color="primary" />
                <Typography variant="h2" component="h1" className="hero-title">
                  Контроль заказ-нарядов и ремонтов техники
                </Typography>
                <Typography className="hero-copy">
                  Вход в MVP-панель: загрузка PDF и фото, создание черновика ремонта,
                  контроль очереди проверки и история по технике.
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleLogin} className="login-form">
                <Stack spacing={2}>
                  <TextField
                    label="Логин"
                    value={loginValue}
                    onChange={(event) => setLoginValue(event.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Пароль"
                    type="password"
                    value={passwordValue}
                    onChange={(event) => setPasswordValue(event.target.value)}
                    required
                    fullWidth
                  />
                  {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
                  <Button type="submit" variant="contained" size="large" disabled={loginLoading}>
                    {loginLoading ? "Вход..." : "Войти в систему"}
                  </Button>
                </Stack>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Card className="feature-card" elevation={0}>
                    <CardContent>
                      <Typography variant="h6">Документы</Typography>
                      <Typography className="muted-copy">
                        Приём PDF, сканов и фото с привязкой к ремонту и технике.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card className="feature-card" elevation={0}>
                    <CardContent>
                      <Typography variant="h6">Контроль</Typography>
                      <Typography className="muted-copy">
                        Очередь проверки, статусы, черновики ремонта и ручная верификация.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card className="feature-card" elevation={0}>
                    <CardContent>
                      <Typography variant="h6">История</Typography>
                      <Typography className="muted-copy">
                        Вся техника, связи грузовик-прицеп и история документов в одном месте.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box className="app-shell">
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Paper className="topbar" elevation={0}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
              <Box>
                <Typography variant="overline" className="eyebrow">
                  Road700 workspace
                </Typography>
                <Typography variant="h4" component="h1">
                  Операционная панель заказ-нарядов
                </Typography>
                <Typography className="muted-copy">
                  {user ? `${user.full_name} · ${user.role}` : "Загрузка профиля"}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={user?.email || "user"} />
                <Button variant="outlined" onClick={handleLogout}>
                  Выйти
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

          {bootLoading ? (
            <Paper className="loading-panel" elevation={0}>
              <Stack spacing={2} alignItems="center">
                <CircularProgress />
                <Typography>Обновление данных...</Typography>
              </Stack>
            </Paper>
          ) : null}

          <Grid container spacing={2}>
            {summaryCards.map((card) => (
              <Grid item xs={12} sm={6} lg={3} key={card.key}>
                <Paper className="metric-card" elevation={0}>
                  <Typography className="metric-label">{card.label}</Typography>
                  <Typography variant="h3">
                    {summary ? summary[card.key] : "—"}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} lg={7}>
              <Paper className="workspace-panel" elevation={0}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h5">Загрузка заказ-наряда</Typography>
                    <Typography className="muted-copy">
                      После загрузки система создаёт черновик ремонта и ставит документ в очередь OCR.
                    </Typography>
                  </Box>

                  <Box component="form" onSubmit={handleUpload}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          label="Техника"
                          value={uploadForm.vehicleId}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, vehicleId: event.target.value }))
                          }
                          fullWidth
                          required
                        >
                          {vehicles.map((vehicle) => (
                            <MenuItem key={vehicle.id} value={String(vehicle.id)}>
                              {formatVehicle(vehicle)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          label="Дата ремонта"
                          type="date"
                          value={uploadForm.repairDate}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, repairDate: event.target.value }))
                          }
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          label="Пробег"
                          type="number"
                          value={uploadForm.mileage}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, mileage: event.target.value }))
                          }
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Номер заказ-наряда"
                          value={uploadForm.orderNumber}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, orderNumber: event.target.value }))
                          }
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Причина ремонта"
                          value={uploadForm.reason}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, reason: event.target.value }))
                          }
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Комментарий сотрудника"
                          value={uploadForm.employeeComment}
                          onChange={(event) =>
                            setUploadForm((current) => ({
                              ...current,
                              employeeComment: event.target.value,
                            }))
                          }
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Примечание к документу"
                          value={uploadForm.notes}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, notes: event.target.value }))
                          }
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Paper className="file-drop" elevation={0}>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", md: "center" }}
                          >
                            <Box>
                              <Typography variant="subtitle1">Файл документа</Typography>
                              <Typography className="muted-copy">
                                Поддерживаются PDF и изображения. OCR-обработка будет добавлена следующим шагом.
                              </Typography>
                            </Box>
                            <Button component="label" variant="outlined">
                              Выбрать файл
                              <input
                                hidden
                                type="file"
                                accept=".pdf,image/*"
                                onChange={(event) =>
                                  setSelectedFile(event.target.files?.[0] ?? null)
                                }
                              />
                            </Button>
                          </Stack>
                          <Typography className="selected-file">
                            {selectedFile ? selectedFile.name : "Файл ещё не выбран"}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12}>
                        <Button
                          type="submit"
                          variant="contained"
                          size="large"
                          disabled={uploadLoading || !selectedFile || !uploadForm.vehicleId}
                        >
                          {uploadLoading ? "Загрузка..." : "Создать черновик ремонта"}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Stack spacing={3}>
                <Paper className="workspace-panel" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">Последние документы</Typography>
                      <Typography className="muted-copy">
                        Последние загруженные заказ-наряды и сканы по доступной технике.
                      </Typography>
                    </Box>
                    <Stack spacing={1.5}>
                      {documents.map((document) => (
                        <Paper className="document-row" key={document.id} elevation={0}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                              <Typography variant="subtitle1">{document.original_filename}</Typography>
                              <Chip
                                size="small"
                                color={statusColor(document.status)}
                                label={formatStatus(document.status)}
                              />
                            </Stack>
                            <Typography className="muted-copy">
                              {formatVehicle(document.vehicle)}
                            </Typography>
                            <Typography className="muted-copy">
                              Ремонт #{document.repair.id} · {document.repair.repair_date} · пробег {document.repair.mileage}
                            </Typography>
                            {document.notes ? (
                              <Typography className="muted-copy">{document.notes}</Typography>
                            ) : null}
                          </Stack>
                        </Paper>
                      ))}
                      {documents.length === 0 ? (
                        <Typography className="muted-copy">
                          Документы ещё не загружались.
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </Paper>

                <Paper className="workspace-panel" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">Срез по технике</Typography>
                      <Typography className="muted-copy">
                        Первые позиции из реестра техники, доступной текущему пользователю.
                      </Typography>
                    </Box>
                    <Stack spacing={1.25}>
                      {vehicles.slice(0, 8).map((vehicle, index) => (
                        <Box key={vehicle.id}>
                          <Stack direction="row" justifyContent="space-between" spacing={2}>
                            <Box>
                              <Typography>{formatVehicle(vehicle)}</Typography>
                              <Typography className="muted-copy">
                                {vehicle.current_driver_name || "Водитель не указан"}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={vehicle.vehicle_type === "truck" ? "Грузовик" : "Прицеп"}
                            />
                          </Stack>
                          {index < Math.min(vehicles.length, 8) - 1 ? <Divider sx={{ mt: 1.5 }} /> : null}
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
