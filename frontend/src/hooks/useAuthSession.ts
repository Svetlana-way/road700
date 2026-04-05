import { useEffect, useRef, useState, type FormEvent } from "react";
import { TOKEN_STORAGE_KEY, apiRequest, loginRequest } from "../shared/api";
import type {
  ChangePasswordResponse,
  LoginResponse,
  PasswordResetConfirmResponse,
  PasswordResetRequestResponse,
} from "../shared/authApiTypes";

const POST_LOGOUT_MESSAGE_STORAGE_KEY = "road700.post_logout_message";

type UseAuthSessionParams = {
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  onLogoutAppReset: () => void;
};

type InvalidateSessionOptions = {
  message?: string;
  reload?: boolean;
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
  const authRequestIdRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("reset_token") || "";
    setRecoveryTokenValue(resetToken);
    if (resetToken) {
      setShowPasswordRecoveryRequest(true);
    }
  }, []);

  useEffect(() => {
    const pendingMessage = sessionStorage.getItem(POST_LOGOUT_MESSAGE_STORAGE_KEY) || "";
    if (!pendingMessage) {
      return;
    }
    sessionStorage.removeItem(POST_LOGOUT_MESSAGE_STORAGE_KEY);
    setSuccessMessage(pendingMessage);
  }, [setSuccessMessage]);

  function clearStoredSession() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
  }

  function invalidateSession(options?: InvalidateSessionOptions) {
    authRequestIdRef.current += 1;
    const message = options?.message?.trim() || "";
    if (message) {
      sessionStorage.setItem(POST_LOGOUT_MESSAGE_STORAGE_KEY, message);
    } else {
      sessionStorage.removeItem(POST_LOGOUT_MESSAGE_STORAGE_KEY);
    }
    clearStoredSession();
    setShowPasswordChange(false);
    setShowPasswordRecoveryRequest(false);
    setLoginLoading(false);
    setPasswordChangeLoading(false);
    setPasswordRecoveryLoading(false);
    setLoginValue("");
    setPasswordValue("");
    setCurrentPasswordValue("");
    setNewPasswordValue("");
    setRecoveryEmailValue("");
    setRecoveryTokenValue("");
    setRecoveryNewPasswordValue("");
    setErrorMessage("");
    setSuccessMessage(message);
    onLogoutAppReset();
    if (options?.reload) {
      window.location.reload();
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestId = authRequestIdRef.current + 1;
    authRequestIdRef.current = requestId;
    setLoginLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = await loginRequest<LoginResponse>(loginValue, passwordValue);
      if (authRequestIdRef.current !== requestId) {
        return;
      }
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.access_token);
      setToken(payload.access_token);
      setPasswordValue("");
    } catch (error) {
      if (authRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выполнить вход");
    } finally {
      if (authRequestIdRef.current === requestId) {
        setLoginLoading(false);
      }
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

    const requestId = authRequestIdRef.current + 1;
    authRequestIdRef.current = requestId;
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
      if (authRequestIdRef.current !== requestId) {
        return;
      }
      invalidateSession({
        message: result.message ? `${result.message}. Войдите снова с новым паролем.` : "Пароль обновлён. Войдите снова с новым паролем.",
      });
    } catch (error) {
      if (authRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сменить пароль");
    } finally {
      if (authRequestIdRef.current === requestId) {
        setPasswordChangeLoading(false);
      }
    }
  }

  async function handleRequestPasswordRecovery() {
    if (!recoveryEmailValue.trim()) {
      setErrorMessage("Укажите почту для восстановления");
      return;
    }
    const requestId = authRequestIdRef.current + 1;
    authRequestIdRef.current = requestId;
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
      if (authRequestIdRef.current !== requestId) {
        return;
      }
      setSuccessMessage(result.message);
    } catch (error) {
      if (authRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось запросить восстановление пароля");
    } finally {
      if (authRequestIdRef.current === requestId) {
        setPasswordRecoveryLoading(false);
      }
    }
  }

  async function handleConfirmPasswordRecovery() {
    if (!recoveryTokenValue.trim() || !recoveryNewPasswordValue.trim()) {
      setErrorMessage("Укажите токен восстановления и новый пароль");
      return;
    }
    const requestId = authRequestIdRef.current + 1;
    authRequestIdRef.current = requestId;
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
      if (authRequestIdRef.current !== requestId) {
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      window.history.replaceState({}, "", url.toString());
      invalidateSession({
        message: result.message ? `${result.message}. Войдите с новым паролем.` : "Пароль восстановлен. Войдите с новым паролем.",
      });
    } catch (error) {
      if (authRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось восстановить пароль");
    } finally {
      if (authRequestIdRef.current === requestId) {
        setPasswordRecoveryLoading(false);
      }
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
    authRequestIdRef.current += 1;
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
