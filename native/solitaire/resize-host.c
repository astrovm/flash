#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#define SIZE_FILE L"D:\\solitaire-size.txt"
#define NATIVE_SCREEN_WIDTH 586
#define NATIVE_SCREEN_HEIGHT 438

static BOOL parse_dimension(char **cursor, char *end, unsigned int *value) {
  unsigned int result = 0;
  while (*cursor < end && (**cursor == ' ' || **cursor == '\r' ||
                           **cursor == '\n' || **cursor == '\t'))
    ++*cursor;
  if (*cursor == end || **cursor < '0' || **cursor > '9') return FALSE;
  while (*cursor < end && **cursor >= '0' && **cursor <= '9') {
    result = result * 10 + (unsigned int)(**cursor - '0');
    ++*cursor;
  }
  *value = result;
  return TRUE;
}

static BOOL read_window_size(unsigned int *width, unsigned int *height) {
  char buffer[64];
  DWORD bytes_read = 0;
  HANDLE file = CreateFileW(SIZE_FILE, GENERIC_READ,
                            FILE_SHARE_READ | FILE_SHARE_WRITE, NULL,
                            OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (file == INVALID_HANDLE_VALUE) return FALSE;
  BOOL read = ReadFile(file, buffer, sizeof(buffer), &bytes_read, NULL);
  CloseHandle(file);
  char *cursor = buffer;
  char *end = buffer + bytes_read;
  return read && parse_dimension(&cursor, end, width) &&
         parse_dimension(&cursor, end, height) && *width >= 100 &&
         *height >= 100;
}

static DWORD run(void) {
  STARTUPINFOW startup = {0};
  PROCESS_INFORMATION process = {0};
  WCHAR solitaire_path[MAX_PATH];
  unsigned int applied_width = 0;
  unsigned int applied_height = 0;
  int width_adjustment = 0;
  int height_adjustment = 0;
  BOOL calibrated = FALSE;

  startup.cb = sizeof(startup);
  DWORD path_length = GetModuleFileNameW(NULL, solitaire_path, MAX_PATH);
  if (!path_length || path_length == MAX_PATH) return 1;
  WCHAR *filename = solitaire_path + path_length;
  while (filename > solitaire_path && filename[-1] != L'\\') --filename;
  if (filename == solitaire_path) return 1;
  lstrcpyW(filename, L"sol.exe");
  if (!CreateProcessW(solitaire_path, NULL, NULL, NULL, FALSE, 0, NULL, NULL,
                      &startup, &process))
    return 1;

  CloseHandle(process.hThread);
  while (WaitForSingleObject(process.hProcess, 50) == WAIT_TIMEOUT) {
    unsigned int width;
    unsigned int height;
    HWND solitaire = FindWindowW(NULL, L"Solitaire");
    if (!solitaire || !read_window_size(&width, &height)) continue;
    if (width == applied_width && height == applied_height) continue;
    if (!calibrated) {
      RECT bounds;
      if (!GetWindowRect(solitaire, &bounds)) continue;
      width_adjustment = bounds.right - bounds.left - NATIVE_SCREEN_WIDTH;
      height_adjustment = bounds.bottom - bounds.top - NATIVE_SCREEN_HEIGHT;
      calibrated = TRUE;
    }
    if (SetWindowPos(solitaire, NULL, 0, 0, (int)width + width_adjustment,
                     (int)height + height_adjustment,
                     SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE)) {
      applied_width = width;
      applied_height = height;
    }
  }
  CloseHandle(process.hProcess);
  return 0;
}

void WinMainCRTStartup(void) { ExitProcess(run()); }
