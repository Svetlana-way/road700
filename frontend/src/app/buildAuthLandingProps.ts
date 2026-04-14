import { type ComponentProps } from "react";
import { AuthLandingView } from "../components/AuthLandingView";

type AuthLandingViewProps = ComponentProps<typeof AuthLandingView>;
type BuildAuthLandingPropsParams = {
  showPasswordRecoveryRequest: AuthLandingViewProps["showPasswordRecoveryRequest"];
  loginValue: AuthLandingViewProps["loginValue"];
  passwordValue: AuthLandingViewProps["passwordValue"];
  loginLoading: AuthLandingViewProps["loginLoading"];
  recoveryEmailValue: AuthLandingViewProps["recoveryEmailValue"];
  recoveryTokenValue: AuthLandingViewProps["recoveryTokenValue"];
  recoveryNewPasswordValue: AuthLandingViewProps["recoveryNewPasswordValue"];
  passwordRecoveryLoading: AuthLandingViewProps["passwordRecoveryLoading"];
  errorMessage: AuthLandingViewProps["errorMessage"];
  successMessage: AuthLandingViewProps["successMessage"];
  handleLogin: AuthLandingViewProps["onLoginSubmit"];
  setLoginValue: AuthLandingViewProps["onLoginValueChange"];
  setPasswordValue: AuthLandingViewProps["onPasswordValueChange"];
  openPasswordRecovery: AuthLandingViewProps["onOpenPasswordRecovery"];
  setRecoveryEmailValue: AuthLandingViewProps["onRecoveryEmailValueChange"];
  handleRequestPasswordRecovery: () => void | Promise<void>;
  setRecoveryTokenValue: AuthLandingViewProps["onRecoveryTokenValueChange"];
  setRecoveryNewPasswordValue: AuthLandingViewProps["onRecoveryNewPasswordValueChange"];
  handleConfirmPasswordRecovery: () => void | Promise<void>;
  handleBackToLogin: AuthLandingViewProps["onBackToLogin"];
};

export function buildAuthLandingProps(params: BuildAuthLandingPropsParams): AuthLandingViewProps {
  return {
    showPasswordRecoveryRequest: params.showPasswordRecoveryRequest,
    loginValue: params.loginValue,
    passwordValue: params.passwordValue,
    loginLoading: params.loginLoading,
    recoveryEmailValue: params.recoveryEmailValue,
    recoveryTokenValue: params.recoveryTokenValue,
    recoveryNewPasswordValue: params.recoveryNewPasswordValue,
    passwordRecoveryLoading: params.passwordRecoveryLoading,
    errorMessage: params.errorMessage,
    successMessage: params.successMessage,
    onLoginSubmit: params.handleLogin,
    onLoginValueChange: params.setLoginValue,
    onPasswordValueChange: params.setPasswordValue,
    onOpenPasswordRecovery: params.openPasswordRecovery,
    onRecoveryEmailValueChange: params.setRecoveryEmailValue,
    onRequestPasswordRecovery: () => {
      void params.handleRequestPasswordRecovery();
    },
    onRecoveryTokenValueChange: params.setRecoveryTokenValue,
    onRecoveryNewPasswordValueChange: params.setRecoveryNewPasswordValue,
    onConfirmPasswordRecovery: () => {
      void params.handleConfirmPasswordRecovery();
    },
    onBackToLogin: params.handleBackToLogin,
  };
}
