export interface Tab {
  id: string;
  url: string;
  title: string;
}

export interface SocketCommand {
  type: 'OPEN_URL' | 'CLOSE_TAB' | 'SWITCH_TAB' | 'GET_PRINT' | 'LOCK_DEVICE' | 'UNLOCK_DEVICE';
  payload?: any;
}
