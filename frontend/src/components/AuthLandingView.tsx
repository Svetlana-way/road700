import { type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type AuthLandingViewProps = {
  showPasswordRecoveryRequest: boolean;
  loginValue: string;
  passwordValue: string;
  loginLoading: boolean;
  recoveryEmailValue: string;
  recoveryTokenValue: string;
  recoveryNewPasswordValue: string;
  passwordRecoveryLoading: boolean;
  errorMessage: string;
  successMessage: string;
  onLoginSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLoginValueChange: (value: string) => void;
  onPasswordValueChange: (value: string) => void;
  onOpenPasswordRecovery: () => void;
  onRecoveryEmailValueChange: (value: string) => void;
  onRequestPasswordRecovery: () => void;
  onRecoveryTokenValueChange: (value: string) => void;
  onRecoveryNewPasswordValueChange: (value: string) => void;
  onConfirmPasswordRecovery: () => void;
  onBackToLogin: () => void;
};

export function AuthLandingView({
  showPasswordRecoveryRequest,
  loginValue,
  passwordValue,
  loginLoading,
  recoveryEmailValue,
  recoveryTokenValue,
  recoveryNewPasswordValue,
  passwordRecoveryLoading,
  errorMessage,
  successMessage,
  onLoginSubmit,
  onLoginValueChange,
  onPasswordValueChange,
  onOpenPasswordRecovery,
  onRecoveryEmailValueChange,
  onRequestPasswordRecovery,
  onRecoveryTokenValueChange,
  onRecoveryNewPasswordValueChange,
  onConfirmPasswordRecovery,
  onBackToLogin,
}: AuthLandingViewProps) {
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
                Вход в MVP-панель: загрузка PDF и фото, создание черновика ремонта, контроль очереди проверки и
                история по технике.
              </Typography>
            </Box>

            {!showPasswordRecoveryRequest ? (
              <Box component="form" onSubmit={onLoginSubmit} className="login-form">
                <Stack spacing={2}>
                  <TextField
                    label="Логин"
                    value={loginValue}
                    onChange={(event) => onLoginValueChange(event.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Пароль"
                    type="password"
                    value={passwordValue}
                    onChange={(event) => onPasswordValueChange(event.target.value)}
                    required
                    fullWidth
                  />
                  {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
                  {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button type="submit" variant="contained" size="large" disabled={loginLoading}>
                      {loginLoading ? "Вход..." : "Войти в систему"}
                    </Button>
                    <Button type="button" variant="text" onClick={onOpenPasswordRecovery}>
                      Забыли пароль?
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ) : (
              <Paper className="repair-line" elevation={0}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6">Восстановление пароля</Typography>
                    <Typography className="muted-copy">
                      Сначала запросите ссылку по почте, затем установите новый пароль по токену из письма.
                    </Typography>
                  </Box>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Почта пользователя"
                        value={recoveryEmailValue}
                        onChange={(event) => onRecoveryEmailValueChange(event.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Button variant="outlined" disabled={passwordRecoveryLoading} onClick={onRequestPasswordRecovery}>
                        {passwordRecoveryLoading ? "Отправка..." : "Запросить восстановление"}
                      </Button>
                    </Grid>
                    <Grid item xs={12}>
                      <Divider />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Токен восстановления"
                        value={recoveryTokenValue}
                        onChange={(event) => onRecoveryTokenValueChange(event.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Новый пароль"
                        type="password"
                        value={recoveryNewPasswordValue}
                        onChange={(event) => onRecoveryNewPasswordValueChange(event.target.value)}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                  {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
                  {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button variant="contained" disabled={passwordRecoveryLoading} onClick={onConfirmPasswordRecovery}>
                      {passwordRecoveryLoading ? "Сохранение..." : "Установить новый пароль"}
                    </Button>
                    <Button variant="text" disabled={passwordRecoveryLoading} onClick={onBackToLogin}>
                      Вернуться ко входу
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card className="feature-card" elevation={0}>
                  <CardContent>
                    <Typography variant="h6">Документы</Typography>
                    <Typography className="muted-copy">Приём PDF, сканов и фото с привязкой к ремонту и технике.</Typography>
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
