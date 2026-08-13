#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#define SIZE_FILE L"D:\\boxedwine-window-size.txt"

typedef struct {
  DWORD process_id;
  HWND window;
} WindowSearch;

static BOOL CALLBACK find_process_window(HWND window, LPARAM parameter) {
  WindowSearch *search = (WindowSearch *)parameter;
  DWORD process_id = 0;
  GetWindowThreadProcessId(window, &process_id);
  if (process_id == search->process_id && IsWindowVisible(window) &&
      !GetWindow(window, GW_OWNER)) {
    search->window = window;
    return FALSE;
  }
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
  HANDLE file = CreateFileW(SIZE_FILE, GENERIC_WRITE, FILE_SHARE_READ, NULL,
                            CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
  if (file == INVALID_HANDLE_VALUE) return;
  DWORD written;
  WriteFile(file, buffer, (DWORD)(cursor - buffer), &written, NULL);
  CloseHandle(file);
}

static DWORD run(void) {
  STARTUPINFOW startup = {0};
  PROCESS_INFORMATION process = {0};
  WCHAR calculator_path[MAX_PATH];
  unsigned int previous_width = 0;
  unsigned int previous_height = 0;

  startup.cb = sizeof(startup);
  DWORD path_length = GetModuleFileNameW(NULL, calculator_path, MAX_PATH);
  if (!path_length || path_length == MAX_PATH) return 1;
  WCHAR *filename = calculator_path + path_length;
  while (filename > calculator_path && filename[-1] != L'\\') --filename;
  if (filename == calculator_path) return 1;
  lstrcpyW(filename, L"calc.exe");
  if (!CreateProcessW(calculator_path, NULL, NULL, NULL, FALSE, 0, NULL, NULL,
                      &startup, &process))
    return 1;

  CloseHandle(process.hThread);
  while (WaitForSingleObject(process.hProcess, 50) == WAIT_TIMEOUT) {
    WindowSearch search = {process.dwProcessId, NULL};
    RECT bounds;
    EnumWindows(find_process_window, (LPARAM)&search);
    if (!search.window || !GetWindowRect(search.window, &bounds)) continue;
    unsigned int width = (unsigned int)(bounds.right - bounds.left);
    unsigned int height = (unsigned int)(bounds.bottom - bounds.top);
    if (width == previous_width && height == previous_height) continue;
    write_window_size(width, height);
    previous_width = width;
    previous_height = height;
  }
  CloseHandle(process.hProcess);
  return 0;
}

void WinMainCRTStartup(void) { ExitProcess(run()); }
