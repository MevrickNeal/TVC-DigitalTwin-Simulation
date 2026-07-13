[Setup]
AppName=Project Neal TVC Digital Twin
AppVersion=2.0
AppPublisher=Mevrick Neal — Aerospace Engineering
AppPublisherURL=https://github.com/MevrickNeal/TVC-DigitalTwin-Simulation
DefaultDirName={autopf}\ProjectNeal
DefaultGroupName=Project Neal
OutputBaseFilename=ProjectNeal_Setup_v2.0
OutputDir=installer_out
SetupIconFile=logo.ico
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
WizardImageFile=installer_banner.bmp
WizardSmallImageFile=installer_small.bmp
LicenseFile=LICENSE
UninstallDisplayIcon={app}\ProjectNeal.exe
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1

[Files]
; Main application folder (PyInstaller --onedir output)
Source: "dist\ProjectNeal\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Project Neal — Mission Control"; Filename: "{app}\ProjectNeal.exe"; Comment: "TVC Digital Twin Dashboard"
Name: "{group}\{cm:UninstallProgram,Project Neal}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Project Neal"; Filename: "{app}\ProjectNeal.exe"; Tasks: desktopicon; Comment: "TVC Digital Twin Dashboard"

[Run]
Filename: "{app}\ProjectNeal.exe"; Description: "{cm:LaunchProgram,Project Neal}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
procedure InitializeWizard;
begin
  WizardForm.Color := $160d09;
end;
