!macro customCheckAppRunning
  ReadRegStr $R0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R1
  ${If} $R1 == 0
    DetailPrint "Closing running ${PRODUCT_NAME}..."
    !ifdef INSTALL_MODE_PER_ALL_USERS
      nsExec::Exec `taskkill /im "${APP_EXECUTABLE_FILENAME}"`
    !else
      nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /im "${APP_EXECUTABLE_FILENAME}" /fi "USERNAME eq %USERNAME%"`
    !endif

    Sleep 500
    StrCpy $R2 0
    netior_close_loop:
      IntOp $R2 $R2 + 1
      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R1
      ${If} $R1 == 0
        Sleep 1000
        !ifdef INSTALL_MODE_PER_ALL_USERS
          nsExec::Exec `taskkill /f /im "${APP_EXECUTABLE_FILENAME}"`
        !else
          nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "USERNAME eq %USERNAME%"`
        !endif
        !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R1
        ${If} $R1 == 0
          ${If} $R2 > 1
            MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY netior_close_loop
            Quit
          ${EndIf}
          Goto netior_close_loop
        ${EndIf}
      ${EndIf}
    Goto netior_check_done
  ${EndIf}

  ${If} $R0 == ""
    Goto netior_check_done
  ${EndIf}

  DetailPrint "No running ${PRODUCT_NAME} process detected. Pre-cleaning previous install at $R0"
  RMDir /r "$R0"

  IfFileExists "$R0\\*.*" 0 +4
    DetailPrint "Pre-cleanup failed for $R0. Falling back to default app-running check."
    Goto netior_check_done

  DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
  DeleteRegKey SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}"
  netior_check_done:
!macroend

!macro _netiorManualCleanupOldInstall
  ${If} $R0 != 0
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R1
    ${If} $R1 != 0
      StrCpy $R2 "$INSTDIR"
      ${If} $R2 != ""
        DetailPrint "Old uninstaller returned $R0. Attempting manual cleanup of $R2"
        RMDir /r "$R2"

        IfFileExists "$R2\\*.*" 0 +3
          DetailPrint "Manual cleanup failed for $R2"
          Return

        ${If} "$rootKey_uninstallResult" == "SHELL_CONTEXT"
          DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}"
          !ifdef UNINSTALL_REGISTRY_KEY_2
            DeleteRegKey SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY_2}"
          !endif
          DeleteRegKey SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}"
        ${ElseIf} "$rootKey_uninstallResult" == "HKEY_CURRENT_USER"
          DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
          !ifdef UNINSTALL_REGISTRY_KEY_2
            DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
          !endif
          DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
        ${ElseIf} "$rootKey_uninstallResult" == "HKEY_LOCAL_MACHINE"
          DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
          !ifdef UNINSTALL_REGISTRY_KEY_2
            DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY_2}"
          !endif
          DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
        ${EndIf}

        DetailPrint "Manual cleanup succeeded for $R2"
        ClearErrors
        StrCpy $R0 0
        Return
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstallCheck
  !insertmacro _netiorManualCleanupOldInstall
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro _netiorManualCleanupOldInstall
!macroend
