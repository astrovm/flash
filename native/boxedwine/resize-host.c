// Wrapper: launches the real application as a child process and resizes
// only that child's own window using a request file the shell writes on the
// D: drive. Combined with a native-side launch-token fix (see
// BOXEDWINE-LAUNCH-TOKEN.patch and source/kernel/kprocess.cpp), the child's
// window is correctly attributed to this launch even though its OS-level
// parent is the shared wineserver, not this process.

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#define CONFIG_NAME L"resize-host.txt"
#define MIN_DIMENSION 100

typedef struct {
  DWORD process_id;
  HWND window;
  LONG area;
} WindowSearch;

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

static BOOL read_requested_size(const WCHAR *path, unsigned int *width,
                                unsigned int *height) {
  char buffer[64];
  DWORD bytes_read = 0;
  HANDLE file =
      CreateFileW(path, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL,
                  OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (file == INVALID_HANDLE_VALUE) return FALSE;
  BOOL read = ReadFile(file, buffer, sizeof(buffer), &bytes_read, NULL);
  CloseHandle(file);
  char *cursor = buffer;
  char *end = buffer + bytes_read;
  return read && parse_dimension(&cursor, end, width) &&
         parse_dimension(&cursor, end, height) && *width >= MIN_DIMENSION &&
         *height >= MIN_DIMENSION;
}

static BOOL CALLBACK find_process_window(HWND window, LPARAM parameter) {
  WindowSearch *search = (WindowSearch *)parameter;
  DWORD process_id = 0;
  RECT bounds;
  GetWindowThreadProcessId(window, &process_id);
  if (process_id != search->process_id || !IsWindowVisible(window) ||
      GetWindow(window, GW_OWNER) || !GetWindowRect(window, &bounds))
    return TRUE;
  LONG area = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
  if (area > search->area) {
    search->window = window;
    search->area = area;
  }
  return TRUE;
}

static BOOL read_config(const WCHAR *directory, WCHAR *application_path,
                        WCHAR *request_path) {
  WCHAR config_path[MAX_PATH];
  char buffer[MAX_PATH * 2];
  DWORD bytes_read = 0;
  lstrcpyW(config_path, directory);
  lstrcatW(config_path, CONFIG_NAME);
  HANDLE file = CreateFileW(config_path, GENERIC_READ, FILE_SHARE_READ, NULL,
                            OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (file == INVALID_HANDLE_VALUE) return FALSE;
  BOOL read = ReadFile(file, buffer, sizeof(buffer) - 1, &bytes_read, NULL);
  CloseHandle(file);
  if (!read || !bytes_read) return FALSE;

  WCHAR executable[MAX_PATH];
  unsigned int index = 0;
  unsigned int length = 0;
  while (index < bytes_read && buffer[index] != '\r' && buffer[index] != '\n' &&
         length < MAX_PATH - 1)
    executable[length++] = (WCHAR)(unsigned char)buffer[index++];
  executable[length] = 0;
  if (!length) return FALSE;
  while (index < bytes_read && (buffer[index] == '\r' || buffer[index] == '\n'))
    ++index;
  length = 0;
  while (index < bytes_read && buffer[index] != '\r' && buffer[index] != '\n' &&
         length < MAX_PATH - 1)
    request_path[length++] = (WCHAR)(unsigned char)buffer[index++];
  request_path[length] = 0;
  if (!length) return FALSE;

  lstrcpyW(application_path, directory);
  lstrcatW(application_path, executable);
  return GetFileAttributesW(application_path) != INVALID_FILE_ATTRIBUTES;
}

static DWORD run(void) {
  STARTUPINFOW startup = {0};
  PROCESS_INFORMATION process = {0};
  WCHAR directory[MAX_PATH];
  WCHAR application_path[MAX_PATH];
  WCHAR request_path[MAX_PATH];
  unsigned int applied_width = 0;
  unsigned int applied_height = 0;

  startup.cb = sizeof(startup);
  DWORD path_length = GetModuleFileNameW(NULL, directory, MAX_PATH);
  if (!path_length || path_length == MAX_PATH) return 1;
  while (path_length && directory[path_length - 1] != L'\\') --path_length;
  if (!path_length) return 1;
  directory[path_length] = 0;
  if (!read_config(directory, application_path, request_path)) return 1;
  // The target (e.g. sol.exe) locates its sibling DLLs (cards.dll) relative
  // to its own working directory. Leaving lpCurrentDirectory NULL makes it
  // inherit this wrapper's own CWD instead, which is not necessarily the
  // same folder, and the app can silently stall mid-layout if a dependency
  // fails to load from there.
  if (!CreateProcessW(application_path, NULL, NULL, NULL, FALSE, 0, NULL,
                      directory, &startup, &process))
    return 1;

  CloseHandle(process.hThread);
  while (WaitForSingleObject(process.hProcess, 50) == WAIT_TIMEOUT) {
    unsigned int width;
    unsigned int height;
    WindowSearch search = {process.dwProcessId, NULL, 0};
    EnumWindows(find_process_window, (LPARAM)&search);
    if (!search.window) continue;
    if (!read_requested_size(request_path, &width, &height)) continue;
    if (width == applied_width && height == applied_height) continue;
    if (SetWindowPos(search.window, NULL, 0, 0, (int)width, (int)height,
                     SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE)) {
      RECT client;
      if (GetClientRect(search.window, &client)) {
        DWORD_PTR ignored;
        SendMessageTimeoutW(
            search.window, WM_SIZE, SIZE_RESTORED,
            MAKELPARAM(client.right - client.left, client.bottom - client.top),
            SMTO_ABORTIFHUNG, 250, &ignored);
        RedrawWindow(search.window, NULL, NULL,
                     RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN |
                         RDW_UPDATENOW);
      }
      applied_width = width;
      applied_height = height;
    }
  }
  CloseHandle(process.hProcess);
  return 0;
}

void WinMainCRTStartup(void) { ExitProcess(run()); }
