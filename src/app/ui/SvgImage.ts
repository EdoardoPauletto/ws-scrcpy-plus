import KeyboardSVG from '../../public/images/skin-light/ic_keyboard_678_48dp.svg';
import MoreSVG from '../../public/images/skin-light/ic_more_horiz_678_48dp.svg';
import CameraSVG from '../../public/images/skin-light/ic_photo_camera_678_48dp.svg';
import PowerSVG from '../../public/images/skin-light/ic_power_settings_new_678_48px.svg';
import VolumeDownSVG from '../../public/images/skin-light/ic_volume_down_678_48px.svg';
import VolumeUpSVG from '../../public/images/skin-light/ic_volume_up_678_48px.svg';
import BackSVG from '../../public/images/skin-light/System_Back_678.svg';
import HomeSVG from '../../public/images/skin-light/System_Home_678.svg';
import OverviewSVG from '../../public/images/skin-light/System_Overview_678.svg';
import CancelSVG from '../../public/images/buttons/cancel.svg';
import OfflineSVG from '../../public/images/buttons/offline.svg';
import RefreshSVG from '../../public/images/buttons/refresh.svg';
import SettingsSVG from '../../public/images/buttons/settings.svg';
import MenuSVG from '../../public/images/buttons/menu.svg';
import ArrowBackSVG from '../../public/images/buttons/arrow_back.svg';
import ToggleOnSVG from '../../public/images/buttons/toggle_on.svg';
import ToggleOffSVG from '../../public/images/buttons/toggle_off.svg';
import FullScreenSVG from '../../public/images/buttons/full_screen.svg';
import SmartphoneSVG from '../../public/images/material/smartphone.svg';
import AndroidSVG from '../../public/images/material/android.svg';
import ApiSVG from '../../public/images/material/api.svg';
import UsbSVG from '../../public/images/material/usb.svg';
import WifiSVG from '../../public/images/material/wifi.svg';
import MemorySVG from '../../public/images/material/memory.svg';
import LanSVG from '../../public/images/material/lan.svg';
import TerminalSVG from '../../public/images/material/terminal.svg';
import CodeSVG from '../../public/images/material/code.svg';
import FolderSVG from '../../public/images/material/folder.svg';
import CastSVG from '../../public/images/material/cast.svg';
import PlayArrowSVG from '../../public/images/material/play_arrow.svg';
import StopSVG from '../../public/images/material/stop.svg';
import MovieSVG from '../../public/images/material/movie.svg';
import DesktopWindowsSVG from '../../public/images/material/desktop_windows.svg';
import AspectRatioSVG from '../../public/images/material/aspect_ratio.svg';
import CropFreeSVG from '../../public/images/material/crop_free.svg';
import GridOnSVG from '../../public/images/material/grid_on.svg';
import BrightnessHighSVG from '../../public/images/material/brightness_high.svg';
import MdVolumeUpSVG from '../../public/images/material/volume_up.svg';
import SpeedSVG from '../../public/images/material/speed.svg';
import TimerSVG from '../../public/images/material/timer.svg';
import ImageSVG from '../../public/images/material/image.svg';
import MdFullscreenSVG from '../../public/images/material/fullscreen.svg';
import TuneSVG from '../../public/images/material/tune.svg';
import InfoSVG from '../../public/images/material/info.svg';
import RestoreSVG from '../../public/images/material/restore.svg';
import FolderOpenSVG from '../../public/images/material/folder_open.svg';
import MdSaveSVG from '../../public/images/material/save.svg';
import WebSVG from '../../public/images/material/web.svg';
import MdNotificationsSVG from '../../public/images/material/notifications.svg';
import MdExpandLessSVG from '../../public/images/material/expand_less.svg';
import MdExpandMoreSVG from '../../public/images/material/expand_more.svg';
import MdScreenRotationSVG from '../../public/images/material/screen_rotation.svg';
import MdContentPasteSVG from '../../public/images/material/content_paste.svg';
import MdContentCopySVG from '../../public/images/material/content_copy.svg';
import MdKeyboardSVG from '../../public/images/material/keyboard.svg';
import MdBarChartSVG from '../../public/images/material/bar_chart.svg';
import MdLogoutSVG from '../../public/images/material/logout.svg';
import MdCheckSVG from '../../public/images/material/check.svg';
import MdSettingsSVG from '../../public/images/material/settings.svg';
import MdAppsSVG from '../../public/images/material/apps.svg';
import MdOpenInNewSVG from '../../public/images/material/open_in_new.svg';

export enum Icon {
    BACK,
    HOME,
    OVERVIEW,
    POWER,
    VOLUME_UP,
    VOLUME_DOWN,
    MORE,
    CAMERA,
    FULL_SCREEN,
    KEYBOARD,
    CANCEL,
    OFFLINE,
    REFRESH,
    SETTINGS,
    MENU,
    ARROW_BACK,
    TOGGLE_ON,
    TOGGLE_OFF,
    SMARTPHONE,
    ANDROID,
    API,
    USB,
    WIFI,
    MEMORY,
    LAN,
    TERMINAL,
    CODE,
    FOLDER,
    CAST,
    PLAY_ARROW,
    STOP,
    MOVIE,
    DESKTOP_WINDOWS,
    ASPECT_RATIO,
    CROP_FREE,
    GRID_ON,
    BRIGHTNESS_HIGH,
    MD_VOLUME_UP,
    SPEED,
    TIMER,
    IMAGE,
    MD_FULLSCREEN,
    TUNE,
    INFO,
    RESTORE,
    FOLDER_OPEN,
    MD_SAVE,
    WEB,
    MD_NOTIFICATIONS,
    MD_EXPAND_LESS,
    MD_EXPAND_MORE,
    MD_SCREEN_ROTATION,
    MD_CONTENT_PASTE,
    MD_CONTENT_COPY,
    MD_KEYBOARD,
    MD_BAR_CHART,
    MD_LOGOUT,
    MD_CHECK,
    MD_SETTINGS,
    MD_APPS,
    MD_OPEN_IN_NEW,
}

export default class SvgImage {
    static Icon = Icon;
    private static getSvgString(type: Icon): string {
        switch (type) {
            case Icon.FULL_SCREEN:
                return FullScreenSVG;
            case Icon.KEYBOARD:
                return KeyboardSVG;
            case Icon.MORE:
                return MoreSVG;
            case Icon.CAMERA:
                return CameraSVG;
            case Icon.POWER:
                return PowerSVG;
            case Icon.VOLUME_DOWN:
                return VolumeDownSVG;
            case Icon.VOLUME_UP:
                return VolumeUpSVG;
            case Icon.BACK:
                return BackSVG;
            case Icon.HOME:
                return HomeSVG;
            case Icon.OVERVIEW:
                return OverviewSVG;
            case Icon.CANCEL:
                return CancelSVG;
            case Icon.OFFLINE:
                return OfflineSVG;
            case Icon.REFRESH:
                return RefreshSVG;
            case Icon.SETTINGS:
                return SettingsSVG;
            case Icon.MENU:
                return MenuSVG;
            case Icon.ARROW_BACK:
                return ArrowBackSVG;
            case Icon.TOGGLE_ON:
                return ToggleOnSVG;
            case Icon.TOGGLE_OFF:
                return ToggleOffSVG;
            case Icon.SMARTPHONE:
                return SmartphoneSVG;
            case Icon.ANDROID:
                return AndroidSVG;
            case Icon.API:
                return ApiSVG;
            case Icon.USB:
                return UsbSVG;
            case Icon.WIFI:
                return WifiSVG;
            case Icon.MEMORY:
                return MemorySVG;
            case Icon.LAN:
                return LanSVG;
            case Icon.TERMINAL:
                return TerminalSVG;
            case Icon.CODE:
                return CodeSVG;
            case Icon.FOLDER:
                return FolderSVG;
            case Icon.CAST:
                return CastSVG;
            case Icon.PLAY_ARROW:
                return PlayArrowSVG;
            case Icon.STOP:
                return StopSVG;
            case Icon.MOVIE:
                return MovieSVG;
            case Icon.DESKTOP_WINDOWS:
                return DesktopWindowsSVG;
            case Icon.ASPECT_RATIO:
                return AspectRatioSVG;
            case Icon.CROP_FREE:
                return CropFreeSVG;
            case Icon.GRID_ON:
                return GridOnSVG;
            case Icon.BRIGHTNESS_HIGH:
                return BrightnessHighSVG;
            case Icon.MD_VOLUME_UP:
                return MdVolumeUpSVG;
            case Icon.SPEED:
                return SpeedSVG;
            case Icon.TIMER:
                return TimerSVG;
            case Icon.IMAGE:
                return ImageSVG;
            case Icon.MD_FULLSCREEN:
                return MdFullscreenSVG;
            case Icon.TUNE:
                return TuneSVG;
            case Icon.INFO:
                return InfoSVG;
            case Icon.RESTORE:
                return RestoreSVG;
            case Icon.FOLDER_OPEN:
                return FolderOpenSVG;
            case Icon.MD_SAVE:
                return MdSaveSVG;
            case Icon.WEB:
                return WebSVG;
            case Icon.MD_NOTIFICATIONS:
                return MdNotificationsSVG;
            case Icon.MD_EXPAND_LESS:
                return MdExpandLessSVG;
            case Icon.MD_EXPAND_MORE:
                return MdExpandMoreSVG;
            case Icon.MD_SCREEN_ROTATION:
                return MdScreenRotationSVG;
            case Icon.MD_CONTENT_PASTE:
                return MdContentPasteSVG;
            case Icon.MD_CONTENT_COPY:
                return MdContentCopySVG;
            case Icon.MD_KEYBOARD:
                return MdKeyboardSVG;
            case Icon.MD_BAR_CHART:
                return MdBarChartSVG;
            case Icon.MD_LOGOUT:
                return MdLogoutSVG;
            case Icon.MD_CHECK:
                return MdCheckSVG;
            case Icon.MD_SETTINGS:
                return MdSettingsSVG;
            case Icon.MD_APPS:
                return MdAppsSVG;
            case Icon.MD_OPEN_IN_NEW:
                return MdOpenInNewSVG;
            default:
                return '';
        }
    }
    public static create(type: Icon): Element {
        const dummy = document.createElement('div');
        dummy.innerHTML = this.getSvgString(type);
        const svg = dummy.children[0];
        const titles = svg.getElementsByTagName('title');
        for (let i = 0, l = titles.length; i < l; i++) {
            svg.removeChild(titles[i]);
        }
        return svg;
    }
}
