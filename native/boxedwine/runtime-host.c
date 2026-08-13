#define WIN32_LEAN_AND_MEAN

typedef unsigned char BYTE;
typedef unsigned short WORD;
typedef unsigned long DWORD;
typedef int BOOL;
typedef void *HANDLE;

typedef struct {
  DWORD cb;
  char *lpReserved;
  char *lpDesktop;
  char *lpTitle;
  DWORD dwX;
  DWORD dwY;
  DWORD dwXSize;
  DWORD dwYSize;
  DWORD dwXCountChars;
  DWORD dwYCountChars;
  DWORD dwFillAttribute;
  DWORD dwFlags;
  WORD wShowWindow;
  WORD cbReserved2;
  BYTE *lpReserved2;
  HANDLE hStdInput;
  HANDLE hStdOutput;
  HANDLE hStdError;
} STARTUPINFOA;

typedef struct {
  HANDLE hProcess;
  HANDLE hThread;
  DWORD dwProcessId;
  DWORD dwThreadId;
} PROCESS_INFORMATION;

#define WINAPI __stdcall
#define FALSE 0
#define TRUE 1
#define GENERIC_READ 0x80000000UL
#define GENERIC_WRITE 0x40000000UL
#define FILE_SHARE_READ 0x00000001UL
#define FILE_SHARE_WRITE 0x00000002UL
#define CREATE_ALWAYS 2UL
#define OPEN_EXISTING 3UL
#define FILE_ATTRIBUTE_NORMAL 0x00000080UL
#define INVALID_HANDLE_VALUE ((HANDLE)-1)

#define COMMAND_FILE "D:\\boxedwine-launch.txt"
#define READY_FILE "D:\\boxedwine-runtime-ready.txt"
#define ACCEPTED_FILE "D:\\boxedwine-launch-accepted.txt"
#define RESULT_FILE "D:\\boxedwine-launch-result.txt"

__declspec(dllimport) HANDLE WINAPI CreateFileA(const char *, DWORD, DWORD,
                                                void *, DWORD, DWORD, HANDLE);
__declspec(dllimport) BOOL WINAPI ReadFile(HANDLE, void *, DWORD, DWORD *,
                                          void *);
__declspec(dllimport) BOOL WINAPI WriteFile(HANDLE, const void *, DWORD,
                                           DWORD *, void *);
__declspec(dllimport) BOOL WINAPI CloseHandle(HANDLE);
__declspec(dllimport) BOOL WINAPI CreateProcessA(
    const char *, char *, void *, void *, BOOL, DWORD, void *, const char *,
    STARTUPINFOA *, PROCESS_INFORMATION *);
__declspec(dllimport) DWORD WINAPI GetLastError(void);
__declspec(dllimport) void WINAPI Sleep(DWORD);
__declspec(dllimport) void WINAPI ExitProcess(unsigned int);

static DWORD string_length(const char *text) {
  DWORD length = 0;
  while (text[length]) ++length;
  return length;
}

static void append_number(char **cursor, DWORD value) {
  char digits[16];
  DWORD length = 0;
  do {
    digits[length++] = (char)('0' + value % 10);
    value /= 10;
  } while (value);
  while (length) *(*cursor)++ = digits[--length];
}

static void write_text(const char *path, const char *text, DWORD length) {
  HANDLE file = CreateFileA(path, GENERIC_WRITE,
                            FILE_SHARE_READ | FILE_SHARE_WRITE, 0,
                            CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, 0);
  if (file == INVALID_HANDLE_VALUE) return;
  DWORD written = 0;
  WriteFile(file, text, length, &written, 0);
  CloseHandle(file);
}

static BOOL read_command(char *buffer, DWORD capacity, DWORD *length) {
  HANDLE file = CreateFileA(COMMAND_FILE, GENERIC_READ,
                            FILE_SHARE_READ | FILE_SHARE_WRITE, 0,
                            OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
  if (file == INVALID_HANDLE_VALUE) return FALSE;
  BOOL result = ReadFile(file, buffer, capacity - 1, length, 0);
  CloseHandle(file);
  if (!result) return FALSE;
  buffer[*length] = 0;
  return TRUE;
}

static void report_result(DWORD sequence, DWORD process_id, DWORD error) {
  char result[64];
  char *cursor = result;
  append_number(&cursor, sequence);
  *cursor++ = ' ';
  append_number(&cursor, process_id);
  *cursor++ = ' ';
  append_number(&cursor, error);
  write_text(RESULT_FILE, result, (DWORD)(cursor - result));
}

static DWORD process_command(char *command, DWORD previous_sequence) {
  DWORD sequence = 0;
  char *cursor = command;
  while (*cursor >= '0' && *cursor <= '9') {
    sequence = sequence * 10 + (DWORD)(*cursor - '0');
    ++cursor;
  }
  if (!sequence || sequence == previous_sequence) return previous_sequence;
  if (*cursor != '\n' && *cursor != '\r') {
    report_result(sequence, 0, 87);
    return sequence;
  }
  while (*cursor == '\n' || *cursor == '\r') ++cursor;
  char *path = cursor;
  while (*cursor && *cursor != '\n' && *cursor != '\r') ++cursor;
  *cursor = 0;
  if (!*path) {
    report_result(sequence, 0, 87);
    return sequence;
  }

  char accepted[16];
  char *accepted_cursor = accepted;
  append_number(&accepted_cursor, sequence);
  write_text(ACCEPTED_FILE, accepted,
             (DWORD)(accepted_cursor - accepted));

  STARTUPINFOA startup = {0};
  PROCESS_INFORMATION process = {0};
  startup.cb = sizeof(startup);
  if (!CreateProcessA(path, 0, 0, 0, FALSE, 0, 0, 0, &startup, &process)) {
    report_result(sequence, 0, GetLastError());
    return sequence;
  }
  report_result(sequence, process.dwProcessId, 0);
  CloseHandle(process.hThread);
  CloseHandle(process.hProcess);
  return sequence;
}

static DWORD run(void) {
  char command[512];
  DWORD previous_sequence = 0;
  write_text(READY_FILE, "ready", string_length("ready"));
  for (;;) {
    DWORD length = 0;
    if (read_command(command, sizeof(command), &length) && length)
      previous_sequence = process_command(command, previous_sequence);
    Sleep(20);
  }
}

void WinMainCRTStartup(void) { ExitProcess(run()); }
