import { useEffect, useState, type FormEvent } from "react";
import { TOKEN_STORAGE_KEY, apiRequest, loginRequest } from "../shared/api";

type LoginResponse = {
  access_token: string;
};

type ChangePasswordResponse = {
  message: string;
};

type PasswordResetRequestResponse = {
  message: string;
};

type PasswordResetConfirmResponse = {
  message: string;
};

type UseAuthSessionParams = {
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  onLogoutAppReset: () => void;
};

export function useAuthSession({
  setErrorMessage,
  setSuccessMessage,
  onLogoutAppReset,
}: UseAuthSessionParams) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || "");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showPasswordRecoveryRequest, setShowPasswordRecoveryRequest] = useState(false);
  const [loginValue, setLoginValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [currentPasswordValue, setCurrentPasswordValue] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [recoveryEmailValue, setRecoveryEmailValue] = useState("");
  const [recoveryTokenValue, setRecoveryTokenValue] = useState("");
  const [recoveryNewPasswordValue, setRecoveryNewPasswordValue] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordRecoveryLoading, setPasswordRecoveryLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("reset_token") || "";
    setRecoveryTokenValue(resetToken);
    if (resetToken) {
      setShowPasswordRecoveryRequest(true);
    }
  }, []);

  function clearStoredSession() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
  }

  function invalidateSession() {
    clearStoredSession();
    setLoginLoading(false);
    setPasswordChangeLoading(false);
    setPasswordRecoveryLoading(false);
    setCurrentPasswordValue("");
    setNewPasswordValue("");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = await loginRequest<LoginResponse>(loginValue, passwordValue);
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.access_token);
      setToken(payload.access_token);
      setPasswordValue("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выполнить вход");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!token) {
      return;
    }
    if (!currentPasswordValue.trim() || !newPasswordValue.trim()) {
      setErrorMessage("Укажите текущий и новый пароль");
      return;
    }

    setPasswordChangeLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<ChangePasswordResponse>(
        "/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            current_password: currentPasswordValue,
            new_password: newPasswordValue,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setCurrentPasswordValue("");
      setNewPasswordValue("");
      setShowPasswordChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сменить пароль");
    } finally {
      setPasswordChangeLoading(false);
    }
  }

  async function handleRequestPasswordRecovery() {
    if (!recoveryEmailValue.trim()) {
      setErrorMessage("Укажите почту для восстановления");
      return;
    }
    setPasswordRecoveryLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<PasswordResetRequestResponse>(
        "/auth/password-reset/request",
        {
          method: "POST",
          body: JSON.stringify({ email: recoveryEmailValue.trim() }),
        },
      );
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось запросить восстановление пароля");
    } finally {
      setPasswordRecoveryLoading(false);
    }
  }

  async function handleConfirmPasswordRecovery() {
    if (!recoveryTokenValue.trim() || !recoveryNewPasswordValue.trim()) {
      setErrorMessage("Укажите токен восстановления и новый пароль");
      return;
    }
    setPasswordRecoveryLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<PasswordResetConfirmResponse>(
        "/auth/password-reset/confirm",
        {
          method: "POST",
          body: JSON.stringify({
            token: recoveryTokenValue.trim(),
            new_password: recoveryNewPasswordValue,
          }),
        },
      );
      setSuccessMessage(result.message);
      setRecoveryNewPasswordValue("");
      setRecoveryTokenValue("");
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      window.history.replaceState({}, "", url.toString());
      setShowPasswordRecoveryRequest(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось восстановить пароль");
    } finally {
      setPasswordRecoveryLoading(false);
    }
  }

  function openPasswordRecovery() {
    setShowPasswordRecoveryRequest(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleBackToLogin() {
    setShowPasswordRecoveryRequest(false);
    setErrorMessage("");
    setSuccessMessage("");
    setRecoveryNewPasswordValue("");
    if (!window.location.search.includes("reset_token=")) {
      setRecoveryTokenValue("");
    }
  }

  function cancelPasswordChange() {
    setShowPasswordChange(false);
    setCurrentPasswordValue("");
    setNewPasswordValue("");
  }

  function handleLogout() {
    clearStoredSession();
    setShowPasswordChange(false);
    setShowPasswordRecoveryRequest(false);
    setCurrentPasswordValue("");
    setNewPasswordValue("");
    setRecoveryEmailValue("");
    setRecoveryTokenValue("");
    setRecoveryNewPasswordValue("");
    setSuccessMessage("");
    setErrorMessage("");
    onLogoutAppReset();
  }

  return {
    token,
    showPasswordChange,
    setShowPasswordChange,
    showPasswordRecoveryRequest,
    loginValue,
    setLoginValue,
    passwordValue,
    setPasswordValue,
    currentPasswordValue,
    setCurrentPasswordValue,
    newPasswordValue,
    setNewPasswordValue,
    recoveryEmailValue,
    setRecoveryEmailValue,
    recoveryTokenValue,
    setRecoveryTokenValue,
    recoveryNewPasswordValue,
    setRecoveryNewPasswordValue,
    loginLoading,
    passwordChangeLoading,
    passwordRecoveryLoading,
    invalidateSession,
    handleLogin,
    handleChangePassword,
    handleRequestPasswordRecovery,
    handleConfirmPasswordRecovery,
    openPasswordRecovery,
    handleBackToLogin,
    cancelPasswordChange,
    handleLogout,
  };
}
