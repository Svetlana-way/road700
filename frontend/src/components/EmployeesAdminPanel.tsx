import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { UserAssignment, UserItem, UserRole, Vehicle, VehicleType } from "../shared/workspaceBootstrapTypes";
import type { UserAssignmentFormState, UserFormState } from "../shared/workspaceFormTypes";

type EmployeesAdminPanelProps = {
  userSearch: string;
  userLoading: boolean;
  showUserEditor: boolean;
  userForm: UserFormState;
  userSaving: boolean;
  usersTotal: number;
  usersList: UserItem[];
  selectedManagedUserId: number | null;
  selectedManagedUser: UserItem | null;
  adminResetPasswordValue: string;
  userVehicleSearch: string;
  userVehicleSearchLoading: boolean;
  userVehicleSearchResults: Vehicle[];
  userAssignmentForm: UserAssignmentFormState;
  userAssignmentSaving: boolean;
  onUserSearchChange: (value: string) => void;
  onRefreshUsers: () => void;
  onResetUsersSearch: () => void;
  onToggleUserEditor: () => void;
  onUserFormChange: (field: keyof UserFormState, value: string) => void;
  onSaveUser: () => void;
  onResetUserForm: () => void;
  onSelectUser: (userId: number) => void;
  onEditUser: (item: UserItem) => void;
  onAdminResetPasswordValueChange: (value: string) => void;
  onAdminResetUserPassword: () => void;
  onUserVehicleSearchChange: (value: string) => void;
  onUserAssignmentFormChange: (field: keyof UserAssignmentFormState, value: string) => void;
  onSearchVehiclesForAssignment: () => void;
  onCreateUserAssignment: (vehicleId: number) => void;
  onCloseUserAssignment: (assignment: UserAssignment) => void;
  formatUserRoleLabel: (value: UserRole) => string;
  formatVehicle: (vehicle: Vehicle | UserAssignment["vehicle"]) => string;
  formatVehicleTypeLabel: (value: VehicleType | "" | null | undefined) => string;
  isAssignmentActive: (assignment: UserAssignment) => boolean;
};

export function EmployeesAdminPanel({
  userSearch,
  userLoading,
  showUserEditor,
  userForm,
  userSaving,
  usersTotal,
  usersList,
  selectedManagedUserId,
  selectedManagedUser,
  adminResetPasswordValue,
  userVehicleSearch,
  userVehicleSearchLoading,
  userVehicleSearchResults,
  userAssignmentForm,
  userAssignmentSaving,
  onUserSearchChange,
  onRefreshUsers,
  onResetUsersSearch,
  onToggleUserEditor,
  onUserFormChange,
  onSaveUser,
  onResetUserForm,
  onSelectUser,
  onEditUser,
  onAdminResetPasswordValueChange,
  onAdminResetUserPassword,
  onUserVehicleSearchChange,
  onUserAssignmentFormChange,
  onSearchVehiclesForAssignment,
  onCreateUserAssignment,
  onCloseUserAssignment,
  formatUserRoleLabel,
  formatVehicle,
  formatVehicleTypeLabel,
  isAssignmentActive,
}: EmployeesAdminPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Сотрудники и доступ</Typography>
          <Typography className="muted-copy">
            Администратор создаёт учётные записи сотрудников и закрепляет за ними технику.
          </Typography>
        </Box>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={8}>
            <TextField
              label="Поиск по имени, логину или почте"
              value={userSearch}
              onChange={(event) => onUserSearchChange(event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={onRefreshUsers} disabled={userLoading}>
                {userLoading ? "Загрузка..." : "Обновить"}
              </Button>
              <Button variant="text" disabled={userLoading} onClick={onResetUsersSearch}>
                Сбросить
              </Button>
            </Stack>
          </Grid>
        </Grid>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant={showUserEditor ? "outlined" : "contained"} onClick={onToggleUserEditor}>
            {showUserEditor ? "Скрыть форму сотрудника" : "Добавить сотрудника"}
          </Button>
        </Stack>
        {showUserEditor ? (
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.25}>
              <Typography className="metric-label">Создание и редактирование пользователя</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="ФИО"
                    value={userForm.full_name}
                    onChange={(event) => onUserFormChange("full_name", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Логин"
                    value={userForm.login}
                    onChange={(event) => onUserFormChange("login", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Почта"
                    value={userForm.email}
                    onChange={(event) => onUserFormChange("email", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    select
                    label="Роль"
                    value={userForm.role}
                    onChange={(event) => onUserFormChange("role", event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="employee">Сотрудник</MenuItem>
                    <MenuItem value="admin">Админ</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    select
                    label="Статус"
                    value={userForm.is_active}
                    onChange={(event) => onUserFormChange("is_active", event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="true">Активен</MenuItem>
                    <MenuItem value="false">Отключен</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={userForm.id ? "Новый пароль, если нужно сменить" : "Пароль"}
                    type="password"
                    value={userForm.password}
                    onChange={(event) => onUserFormChange("password", event.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" disabled={userSaving} onClick={onSaveUser}>
                  {userSaving ? "Сохранение..." : userForm.id ? "Сохранить пользователя" : "Создать пользователя"}
                </Button>
                <Button variant="text" disabled={userSaving} onClick={onResetUserForm}>
                  Сбросить форму
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
        <Typography className="muted-copy">Найдено пользователей: {usersTotal}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} lg={5}>
            {userLoading ? (
              <Stack spacing={1} alignItems="center">
                <CircularProgress size={24} />
                <Typography className="muted-copy">Загрузка сотрудников...</Typography>
              </Stack>
            ) : usersList.length > 0 ? (
              <Stack spacing={1}>
                {usersList.map((item) => {
                  const activeAssignments = item.assignments.filter((assignment) => isAssignmentActive(assignment)).length;
                  return (
                    <Paper
                      className={`document-row${selectedManagedUserId === item.id ? " document-row-active" : ""}`}
                      key={`user-${item.id}`}
                      elevation={0}
                    >
                      <Stack spacing={0.75}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography>{item.full_name}</Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip size="small" variant="outlined" label={formatUserRoleLabel(item.role)} />
                            <Chip
                              size="small"
                              color={item.is_active ? "success" : "default"}
                              label={item.is_active ? "Активен" : "Отключен"}
                            />
                          </Stack>
                        </Stack>
                        <Typography className="muted-copy">
                          {item.login} · {item.email}
                        </Typography>
                        <Typography className="muted-copy">
                          Активных назначений техники: {activeAssignments}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" onClick={() => onSelectUser(item.id)}>
                            Открыть доступы
                          </Button>
                          <Button size="small" variant="text" onClick={() => onEditUser(item)}>
                            Редактировать
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <Typography className="muted-copy">Пользователи пока не заведены.</Typography>
            )}
          </Grid>
          <Grid item xs={12} lg={7}>
            {selectedManagedUser ? (
              <Stack spacing={1.5}>
                <Paper className="repair-line" elevation={0}>
                  <Stack spacing={0.75}>
                    <Typography variant="h6">{selectedManagedUser.full_name}</Typography>
                    <Typography className="muted-copy">
                      {selectedManagedUser.login} · {selectedManagedUser.email}
                    </Typography>
                    <Typography className="muted-copy">
                      {formatUserRoleLabel(selectedManagedUser.role)} · {selectedManagedUser.is_active ? "активен" : "отключен"}
                    </Typography>
                  </Stack>
                </Paper>
                <Paper className="repair-line" elevation={0}>
                  <Stack spacing={1.25}>
                    <Typography className="metric-label">Сброс пароля сотрудника</Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={8}>
                        <TextField
                          label="Новый пароль для сотрудника"
                          type="password"
                          value={adminResetPasswordValue}
                          onChange={(event) => onAdminResetPasswordValueChange(event.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button fullWidth variant="contained" disabled={userSaving} onClick={onAdminResetUserPassword}>
                          {userSaving ? "Сохранение..." : "Сбросить пароль"}
                        </Button>
                      </Grid>
                    </Grid>
                  </Stack>
                </Paper>
                <Paper className="repair-line" elevation={0}>
                  <Stack spacing={1.25}>
                    <Typography className="metric-label">Добавить технику в зону ответственности</Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={5}>
                        <TextField
                          label="Найти технику по госномеру, VIN, марке"
                          value={userVehicleSearch}
                          onChange={(event) => onUserVehicleSearchChange(event.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label="Дата начала"
                          type="date"
                          value={userAssignmentForm.starts_at}
                          onChange={(event) => onUserAssignmentFormChange("starts_at", event.target.value)}
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label="Дата окончания"
                          type="date"
                          value={userAssignmentForm.ends_at}
                          onChange={(event) => onUserAssignmentFormChange("ends_at", event.target.value)}
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <Button fullWidth variant="outlined" disabled={userVehicleSearchLoading} onClick={onSearchVehiclesForAssignment}>
                          {userVehicleSearchLoading ? "Поиск..." : "Найти"}
                        </Button>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Комментарий к назначению"
                          value={userAssignmentForm.comment}
                          onChange={(event) => onUserAssignmentFormChange("comment", event.target.value)}
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Grid>
                    </Grid>
                    {userVehicleSearchResults.length > 0 ? (
                      <Stack spacing={1}>
                        {userVehicleSearchResults.map((vehicle) => (
                          <Paper className="repair-line" key={`assign-vehicle-${vehicle.id}`} elevation={0}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                              <Box>
                                <Typography>{formatVehicle(vehicle)}</Typography>
                                <Typography className="muted-copy">
                                  {formatVehicleTypeLabel(vehicle.vehicle_type)} · {vehicle.vin || "VIN не указан"}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                variant="contained"
                                disabled={userAssignmentSaving}
                                onClick={() => onCreateUserAssignment(vehicle.id)}
                              >
                                Закрепить
                              </Button>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    ) : (
                      <Typography className="muted-copy">
                        Введите запрос и нажмите «Найти», чтобы подобрать технику для сотрудника.
                      </Typography>
                    )}
                  </Stack>
                </Paper>
                <Paper className="repair-line" elevation={0}>
                  <Stack spacing={1.25}>
                    <Typography className="metric-label">Текущие и прошлые назначения техники</Typography>
                    {selectedManagedUser.assignments.length > 0 ? (
                      <Stack spacing={1}>
                        {selectedManagedUser.assignments.map((assignment) => (
                          <Paper className="repair-line" key={`assignment-${assignment.id}`} elevation={0}>
                            <Stack spacing={0.75}>
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Typography>{formatVehicle(assignment.vehicle)}</Typography>
                                <Chip
                                  size="small"
                                  color={isAssignmentActive(assignment) ? "success" : "default"}
                                  label={isAssignmentActive(assignment) ? "Активно" : "Закрыто"}
                                />
                              </Stack>
                              <Typography className="muted-copy">
                                {assignment.starts_at} {assignment.ends_at ? `— ${assignment.ends_at}` : "— без даты окончания"}
                              </Typography>
                              {assignment.comment ? <Typography className="muted-copy">{assignment.comment}</Typography> : null}
                              {isAssignmentActive(assignment) ? (
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    size="small"
                                    variant="text"
                                    disabled={userAssignmentSaving}
                                    onClick={() => onCloseUserAssignment(assignment)}
                                  >
                                    Закрыть доступ сегодня
                                  </Button>
                                </Stack>
                              ) : null}
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    ) : (
                      <Typography className="muted-copy">За этим сотрудником техника ещё не закреплялась.</Typography>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            ) : (
              <Typography className="muted-copy">Выберите сотрудника слева, чтобы управлять доступом к технике.</Typography>
            )}
          </Grid>
        </Grid>
      </Stack>
    </Paper>
  );
}
