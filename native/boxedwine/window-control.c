#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#define COMMAND_PATH L"D:\\boxedwine-window-control.in"
#define STATE_PATH L"D:\\boxedwine-window-control.out"
#define WINE_X11_WINDOW_PROPERTY L"__wine_x11_whole_window"
#define COMMAND_MAGIC 0x42574331u
#define STATE_MAGIC 0x42575331u
#define MAX_WINDOWS 256

enum WindowCommand {
  COMMAND_CLOSE = 1,
  COMMAND_MINIMIZE = 2,
  COMMAND_MAXIMIZE = 3,
  COMMAND_RESTORE = 4,
  COMMAND_BOUNDS = 5,
  COMMAND_ACTIVATE = 6,
};

typedef struct {
  DWORD magic;
  DWORD sequence;
  DWORD window_id;
  DWORD command;
  LONG x;
  LONG y;
  DWORD width;
  DWORD height;
} CommandRecord;

typedef struct {
  DWORD window_id;
  LONG outer_x;
  LONG outer_y;
  DWORD outer_width;
  DWORD outer_height;
  LONG client_x;
  LONG client_y;
  DWORD client_width;
  DWORD client_height;
  DWORD frame_left;
  DWORD frame_top;
  DWORD frame_right;
  DWORD frame_bottom;
  DWORD owner_id;
  DWORD capabilities;
  DWORD menu_height;
} StateRecord;

typedef struct {
  DWORD magic;
  DWORD generation;
  DWORD count;
  StateRecord records[MAX_WINDOWS];
} StateFile;

typedef struct {
  DWORD window_id;
  RECT bounds;
  BOOL valid;
} RestoreRecord;

typedef struct {
  DWORD window_id;
  HWND window;
} WindowSearch;

static StateFile state;
static RestoreRecord restores[MAX_WINDOWS];

static DWORD x_window_id(HWND window) {
  return (DWORD)(UINT_PTR)GetPropW(window, WINE_X11_WINDOW_PROPERTY);
}

static BOOL CALLBACK find_window(HWND window, LPARAM parameter) {
  WindowSearch *search = (WindowSearch *)parameter;
  if (x_window_id(window) != search->window_id) return TRUE;
  search->window = window;
  return FALSE;
}

static HWND window_from_x_id(DWORD window_id) {
  WindowSearch search = {0};
  search.window_id = window_id;
  EnumWindows(find_window, (LPARAM)&search);
  return search.window;
}

static RestoreRecord *restore_for(DWORD window_id, BOOL create) {
  DWORD index;
  RestoreRecord *empty = NULL;
  for (index = 0; index < MAX_WINDOWS; ++index) {
    if (restores[index].valid && restores[index].window_id == window_id)
      return &restores[index];
    if (!restores[index].valid && !empty) empty = &restores[index];
  }
  if (!create || !empty) return NULL;
  empty->window_id = window_id;
  empty->valid = TRUE;
  return empty;
}

static void notify_size(HWND window, WPARAM type) {
  RECT client;
  DWORD_PTR ignored;
  if (!GetClientRect(window, &client)) return;
  SendMessageTimeoutW(window, WM_SIZE, type,
                      MAKELPARAM(client.right, client.bottom),
                      SMTO_ABORTIFHUNG, 250, &ignored);
  RedrawWindow(window, NULL, NULL,
               RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW);
}

static void apply_command(const CommandRecord *command) {
  HWND window = window_from_x_id(command->window_id);
  RestoreRecord *restore;
  if (!window) return;
  if (command->command == COMMAND_CLOSE) {
    PostMessageW(window, WM_CLOSE, 0, 0);
  } else if (command->command == COMMAND_MINIMIZE) {
    ShowWindow(window, SW_MINIMIZE);
  } else if (command->command == COMMAND_MAXIMIZE) {
    restore = restore_for(command->window_id, TRUE);
    if (restore) GetWindowRect(window, &restore->bounds);
    ShowWindow(window, SW_RESTORE);
    if (command->width && command->height)
      SetWindowPos(window, HWND_TOP, command->x, command->y, command->width,
                   command->height, SWP_NOACTIVATE);
    notify_size(window, SIZE_MAXIMIZED);
  } else if (command->command == COMMAND_RESTORE) {
    ShowWindow(window, SW_RESTORE);
    restore = restore_for(command->window_id, FALSE);
    if (restore) {
      SetWindowPos(window, NULL, restore->bounds.left, restore->bounds.top,
                   restore->bounds.right - restore->bounds.left,
                   restore->bounds.bottom - restore->bounds.top,
                   SWP_NOZORDER | SWP_NOACTIVATE);
      restore->valid = FALSE;
    }
    notify_size(window, SIZE_RESTORED);
  } else if (command->command == COMMAND_BOUNDS && command->width &&
             command->height) {
    SetWindowPos(window, NULL, command->x, command->y, command->width,
                 command->height, SWP_NOZORDER | SWP_NOACTIVATE);
    notify_size(window, SIZE_RESTORED);
  } else if (command->command == COMMAND_ACTIVATE) {
    if (IsIconic(window)) ShowWindow(window, SW_RESTORE);
    SetForegroundWindow(window);
  }
}

static BOOL CALLBACK collect_window(HWND window, LPARAM parameter) {
  StateFile *output = (StateFile *)parameter;
  StateRecord *record;
  RECT outer;
  RECT client;
  POINT origin = {0, 0};
  MENUBARINFO menu = {0};
  DWORD window_id = x_window_id(window);
  LONG style;
  HWND owner;
  if (!window_id || output->count >= MAX_WINDOWS ||
      !GetWindowRect(window, &outer) || !GetClientRect(window, &client) ||
      !ClientToScreen(window, &origin))
    return TRUE;
  record = &output->records[output->count++];
  record->window_id = window_id;
  record->outer_x = outer.left;
  record->outer_y = outer.top;
  record->outer_width = outer.right - outer.left;
  record->outer_height = outer.bottom - outer.top;
  record->client_x = origin.x;
  record->client_y = origin.y;
  record->client_width = client.right - client.left;
  record->client_height = client.bottom - client.top;
  record->frame_left = origin.x > outer.left ? origin.x - outer.left : 0;
  record->frame_top = origin.y > outer.top ? origin.y - outer.top : 0;
  record->frame_right = outer.right > origin.x + (LONG)record->client_width
                            ? outer.right - origin.x - record->client_width
                            : 0;
  record->frame_bottom = outer.bottom > origin.y + (LONG)record->client_height
                             ? outer.bottom - origin.y - record->client_height
                             : 0;
  owner = GetWindow(window, GW_OWNER);
  record->owner_id = owner ? x_window_id(owner) : 0;
  style = GetWindowLongW(window, GWL_STYLE);
  record->capabilities =
      ((style & WS_THICKFRAME) ? 1u : 0u) |
      ((style & WS_MAXIMIZEBOX) && (style & WS_THICKFRAME) ? 2u : 0u) |
      ((style & WS_MINIMIZEBOX) ? 4u : 0u);
  menu.cbSize = sizeof(menu);
  record->menu_height = 0;
  if (GetMenu(window)) {
    record->menu_height =
        GetMenuBarInfo(window, OBJID_MENU, 0, &menu) &&
                menu.rcBar.bottom > menu.rcBar.top
            ? menu.rcBar.bottom - menu.rcBar.top
            : GetSystemMetrics(SM_CYMENU);
  }
  return TRUE;
}

static void read_command(DWORD *last_sequence) {
  CommandRecord command;
  DWORD bytes_read = 0;
  HANDLE file = CreateFileW(COMMAND_PATH, GENERIC_READ,
                            FILE_SHARE_READ | FILE_SHARE_WRITE, NULL,
                            OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (file == INVALID_HANDLE_VALUE) return;
  if (ReadFile(file, &command, sizeof(command), &bytes_read, NULL) &&
      bytes_read == sizeof(command) && command.magic == COMMAND_MAGIC &&
      command.sequence != *last_sequence) {
    *last_sequence = command.sequence;
    apply_command(&command);
  }
  CloseHandle(file);
}

static void write_state(void) {
  DWORD bytes_written;
  HANDLE file;
  state.magic = STATE_MAGIC;
  ++state.generation;
  state.count = 0;
  EnumWindows(collect_window, (LPARAM)&state);
  file = CreateFileW(STATE_PATH, GENERIC_WRITE,
                     FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, CREATE_ALWAYS,
                     FILE_ATTRIBUTE_NORMAL, NULL);
  if (file == INVALID_HANDLE_VALUE) return;
  WriteFile(file, &state, 12 + state.count * sizeof(StateRecord),
            &bytes_written, NULL);
  CloseHandle(file);
}

static DWORD run(void) {
  DWORD last_sequence = 0;
  for (;;) {
    read_command(&last_sequence);
    write_state();
    Sleep(50);
  }
}

void WinMainCRTStartup(void) { ExitProcess(run()); }
