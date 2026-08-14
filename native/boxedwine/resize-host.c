#define WIN32_LEAN_AND_MEAN
#include <windows.h>

static const WCHAR *size_file = L"D:\\boxedwine-size.txt";
static const WCHAR *window_size_file = L"D:\\boxedwine-window-size.txt";

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

static void append_number(char **cursor, unsigned int value) {
  char digits[16];
  unsigned int length = 0;
  do {
    digits[length++] = (char)('0' + value % 10);
    value /= 10;
  } while (value);
  while (length) *(*cursor)++ = digits[--length];
}

static void write_window_size(unsigned int width, unsigned int height) {
  char buffer[40];
  char *cursor = buffer;
  append_number(&cursor, width);
  *cursor++ = ' ';
  append_number(&cursor, height);
  HANDLE file = CreateFileW(window_size_file, GENERIC_WRITE, FILE_SHARE_READ,
                            NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
  if (file == INVALID_HANDLE_VALUE) return;
  DWORD written;
  WriteFile(file, buffer, (DWORD)(cursor - buffer), &written, NULL);
  CloseHandle(file);
}

static BOOL read_window_size(unsigned int *width, unsigned int *height,
                             unsigned int *native_width,
                             unsigned int *native_height) {
  char buffer[64];
  DWORD bytes_read = 0;
  HANDLE file = CreateFileW(size_file, GENERIC_READ,
                            FILE_SHARE_READ | FILE_SHARE_WRITE, NULL,
                            OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (file == INVALID_HANDLE_VALUE) return FALSE;
  BOOL read = ReadFile(file, buffer, sizeof(buffer), &bytes_read, NULL);
  CloseHandle(file);
  char *cursor = buffer;
  char *end = buffer + bytes_read;
  return read && parse_dimension(&cursor, end, width) &&
         parse_dimension(&cursor, end, height) &&
         parse_dimension(&cursor, end, native_width) &&
         parse_dimension(&cursor, end, native_height) && *width >= 100 &&
         *height >= 100 && *native_width >= 100 && *native_height >= 100;
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

static BOOL find_target(WCHAR *application_path, WCHAR *filename) {
  static const WCHAR *targets[] = {L"sol.exe", L"freecell.exe", L"spider.exe"};
  static const WCHAR *size_files[] = {
      L"D:\\solsize.txt", L"D:\\freesize.txt", L"D:\\spidsize.txt"};
  static const WCHAR *window_size_files[] = {
      L"D:\\solwindow.txt", L"D:\\freewindow.txt", L"D:\\spidwindow.txt"};
  for (unsigned int index = 0; index < sizeof(targets) / sizeof(targets[0]);
       ++index) {
    lstrcpyW(filename, targets[index]);
    if (GetFileAttributesW(application_path) != INVALID_FILE_ATTRIBUTES) {
      size_file = size_files[index];
      window_size_file = window_size_files[index];
      return TRUE;
    }
  }
  return FALSE;
}

static DWORD run(void) {
  STARTUPINFOW startup = {0};
  PROCESS_INFORMATION process = {0};
  WCHAR application_path[MAX_PATH];
  unsigned int applied_width = 0;
  unsigned int applied_height = 0;
  unsigned int reported_width = 0;
  unsigned int reported_height = 0;
  int width_adjustment = 0;
  int height_adjustment = 0;
  BOOL calibrated = FALSE;

  startup.cb = sizeof(startup);
  DWORD path_length = GetModuleFileNameW(NULL, application_path, MAX_PATH);
  if (!path_length || path_length == MAX_PATH) return 1;
  WCHAR *filename = application_path + path_length;
  while (filename > application_path && filename[-1] != L'\\') --filename;
  if (filename == application_path || !find_target(application_path, filename))
    return 1;
  if (!CreateProcessW(application_path, NULL, NULL, NULL, FALSE, 0, NULL, NULL,
                      &startup, &process))
    return 1;

  CloseHandle(process.hThread);
  while (WaitForSingleObject(process.hProcess, 50) == WAIT_TIMEOUT) {
    unsigned int width;
    unsigned int height;
    unsigned int native_width;
    unsigned int native_height;
    WindowSearch search = {process.dwProcessId, NULL, 0};
    EnumWindows(find_process_window, (LPARAM)&search);
    if (!search.window) continue;
    RECT bounds;
    if (GetWindowRect(search.window, &bounds)) {
      unsigned int current_width = (unsigned int)(bounds.right - bounds.left);
      unsigned int current_height = (unsigned int)(bounds.bottom - bounds.top);
      if (current_width != reported_width ||
          current_height != reported_height) {
        write_window_size(current_width, current_height);
        reported_width = current_width;
        reported_height = current_height;
      }
    }
    if (!read_window_size(&width, &height, &native_width, &native_height))
      continue;
    if (width == applied_width && height == applied_height) continue;
    if (!calibrated) {
      if (!GetWindowRect(search.window, &bounds)) continue;
      width_adjustment = bounds.right - bounds.left - (int)native_width;
      height_adjustment = bounds.bottom - bounds.top - (int)native_height;
      calibrated = TRUE;
    }
    if (SetWindowPos(search.window, NULL, 0, 0, (int)width + width_adjustment,
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
