/**
 * Icon.js — the app's ONLY icon component.
 *
 * Why this exists
 * ---------------
 * The app previously mixed four icon families: Feather for almost everything,
 * plus MaterialIcons / FontAwesome5 / MaterialCommunityIcons in ~10 places. That
 * mix wasn't arbitrary — Feather is outline-only, so any time a FILLED icon was
 * needed (a rated star, an active bookmark) another family had to be pulled in.
 * The cost was visual: those families have different stroke weights and optical
 * sizing, so a filled star sat next to a Feather outline looking heavier and
 * slightly misaligned.
 *
 * Phosphor solves that properly: one family, six weights, so outline and filled
 * are the SAME icon at the same optical size.
 *
 * Why a wrapper instead of importing Phosphor directly
 * ----------------------------------------------------
 * Icon names in this app are not all literals. Several are dynamic, and some
 * come from the BACKEND — `Spot.category.icon` is served by /api/categories, and
 * an admin can add a category with any Feather name without an app release.
 * Renaming icons at the call site would silently break that data.
 *
 * So this component keeps the Feather vocabulary as its public API and maps it
 * to Phosphor internally. Existing call sites, config objects and backend rows
 * all keep working, and swapping the underlying library again later is a change
 * to ONE file.
 *
 * Usage
 *   <Icon name="search" size={20} color={colors.brand} />
 *   <Icon name="bookmark" weight="fill" />     // filled state
 *   <Icon name="star" weight="fill" color={colors.star} />
 */
import React from "react";
// DEEP IMPORTS, one module per icon — deliberate and load-bearing.
//
// Metro does not tree-shake. Importing 82 names from the "phosphor-react-native"
// barrel still pulled ALL 1512 icons x 6 weights into the bundle: it took the
// Android JS bundle from 6.27 MB to 13.4 MB. The package exposes per-icon
// entrypoints ("./src/icons/*" in its exports map) precisely for this.
//
// DO NOT collapse these back into a single barrel import.
import { ApertureIcon } from "phosphor-react-native/src/icons/Aperture";
import { ArrowCircleRightIcon } from "phosphor-react-native/src/icons/ArrowCircleRight";
import { ArrowLeftIcon } from "phosphor-react-native/src/icons/ArrowLeft";
import { ArrowUpRightIcon } from "phosphor-react-native/src/icons/ArrowUpRight";
import { ArrowsClockwiseIcon } from "phosphor-react-native/src/icons/ArrowsClockwise";
import { ArrowsOutIcon } from "phosphor-react-native/src/icons/ArrowsOut";
import { BellIcon } from "phosphor-react-native/src/icons/Bell";
import { BookIcon } from "phosphor-react-native/src/icons/Book";
import { BookOpenIcon } from "phosphor-react-native/src/icons/BookOpen";
import { BookmarkSimpleIcon } from "phosphor-react-native/src/icons/BookmarkSimple";
import { CalendarIcon } from "phosphor-react-native/src/icons/Calendar";
import { CameraIcon } from "phosphor-react-native/src/icons/Camera";
import { CameraSlashIcon } from "phosphor-react-native/src/icons/CameraSlash";
import { CaretDoubleDownIcon } from "phosphor-react-native/src/icons/CaretDoubleDown";
import { CaretDownIcon } from "phosphor-react-native/src/icons/CaretDown";
import { CaretLeftIcon } from "phosphor-react-native/src/icons/CaretLeft";
import { CaretRightIcon } from "phosphor-react-native/src/icons/CaretRight";
import { ChatCircleIcon } from "phosphor-react-native/src/icons/ChatCircle";
import { CheckIcon } from "phosphor-react-native/src/icons/Check";
import { CheckCircleIcon } from "phosphor-react-native/src/icons/CheckCircle";
import { CircleIcon } from "phosphor-react-native/src/icons/Circle";
import { ClockIcon } from "phosphor-react-native/src/icons/Clock";
import { CompassIcon } from "phosphor-react-native/src/icons/Compass";
import { CpuIcon } from "phosphor-react-native/src/icons/Cpu";
import { CrosshairIcon } from "phosphor-react-native/src/icons/Crosshair";
import { CubeFocusIcon } from "phosphor-react-native/src/icons/CubeFocus";
import { CubeTransparentIcon } from "phosphor-react-native/src/icons/CubeTransparent";
import { DeviceMobileIcon } from "phosphor-react-native/src/icons/DeviceMobile";
import { EnvelopeIcon } from "phosphor-react-native/src/icons/Envelope";
import { EyeIcon } from "phosphor-react-native/src/icons/Eye";
import { EyeSlashIcon } from "phosphor-react-native/src/icons/EyeSlash";
import { FileTextIcon } from "phosphor-react-native/src/icons/FileText";
import { FlagIcon } from "phosphor-react-native/src/icons/Flag";
import { GearIcon } from "phosphor-react-native/src/icons/Gear";
import { GlobeIcon } from "phosphor-react-native/src/icons/Globe";
import { GridFourIcon } from "phosphor-react-native/src/icons/GridFour";
import { HouseIcon } from "phosphor-react-native/src/icons/House";
import { ImageIcon } from "phosphor-react-native/src/icons/Image";
import { InfoIcon } from "phosphor-react-native/src/icons/Info";
import { KeyIcon } from "phosphor-react-native/src/icons/Key";
import { LightningIcon } from "phosphor-react-native/src/icons/Lightning";
import { ListIcon } from "phosphor-react-native/src/icons/List";
import { LockIcon } from "phosphor-react-native/src/icons/Lock";
import { MagnifyingGlassIcon } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { MagnifyingGlassMinusIcon } from "phosphor-react-native/src/icons/MagnifyingGlassMinus";
import { MagnifyingGlassPlusIcon } from "phosphor-react-native/src/icons/MagnifyingGlassPlus";
import { MapPinIcon } from "phosphor-react-native/src/icons/MapPin";
import { MapTrifoldIcon } from "phosphor-react-native/src/icons/MapTrifold";
import { MedalIcon } from "phosphor-react-native/src/icons/Medal";
import { MinusIcon } from "phosphor-react-native/src/icons/Minus";
import { MoonIcon } from "phosphor-react-native/src/icons/Moon";
import { NavigationArrowIcon } from "phosphor-react-native/src/icons/NavigationArrow";
import { PackageIcon } from "phosphor-react-native/src/icons/Package";
import { PaperPlaneTiltIcon } from "phosphor-react-native/src/icons/PaperPlaneTilt";
import { PauseIcon } from "phosphor-react-native/src/icons/Pause";
import { PencilSimpleIcon } from "phosphor-react-native/src/icons/PencilSimple";
import { PhoneIcon } from "phosphor-react-native/src/icons/Phone";
import { PlusIcon } from "phosphor-react-native/src/icons/Plus";
import { ProhibitIcon } from "phosphor-react-native/src/icons/Prohibit";
import { QuestionIcon } from "phosphor-react-native/src/icons/Question";
import { ShareNetworkIcon } from "phosphor-react-native/src/icons/ShareNetwork";
import { ShieldCheckIcon } from "phosphor-react-native/src/icons/ShieldCheck";
import { SignOutIcon } from "phosphor-react-native/src/icons/SignOut";
import { SparkleIcon } from "phosphor-react-native/src/icons/Sparkle";
import { SpeakerXIcon } from "phosphor-react-native/src/icons/SpeakerX";
import { StarIcon } from "phosphor-react-native/src/icons/Star";
import { SunIcon } from "phosphor-react-native/src/icons/Sun";
import { TagIcon } from "phosphor-react-native/src/icons/Tag";
import { TargetIcon } from "phosphor-react-native/src/icons/Target";
import { ThumbsDownIcon } from "phosphor-react-native/src/icons/ThumbsDown";
import { ThumbsUpIcon } from "phosphor-react-native/src/icons/ThumbsUp";
import { TrashIcon } from "phosphor-react-native/src/icons/Trash";
import { TrayIcon } from "phosphor-react-native/src/icons/Tray";
import { TruckIcon } from "phosphor-react-native/src/icons/Truck";
import { UserIcon } from "phosphor-react-native/src/icons/User";
import { UserMinusIcon } from "phosphor-react-native/src/icons/UserMinus";
import { UsersIcon } from "phosphor-react-native/src/icons/Users";
import { WarningIcon } from "phosphor-react-native/src/icons/Warning";
import { WarningCircleIcon } from "phosphor-react-native/src/icons/WarningCircle";
import { WifiSlashIcon } from "phosphor-react-native/src/icons/WifiSlash";
import { XIcon } from "phosphor-react-native/src/icons/X";
import { XCircleIcon } from "phosphor-react-native/src/icons/XCircle";

// Explicit component table, built from the named imports above.
const PH = {
  Aperture: ApertureIcon,
  ArrowCircleRight: ArrowCircleRightIcon,
  ArrowLeft: ArrowLeftIcon,
  ArrowUpRight: ArrowUpRightIcon,
  ArrowsClockwise: ArrowsClockwiseIcon,
  ArrowsOut: ArrowsOutIcon,
  Bell: BellIcon,
  Book: BookIcon,
  BookOpen: BookOpenIcon,
  BookmarkSimple: BookmarkSimpleIcon,
  Calendar: CalendarIcon,
  Camera: CameraIcon,
  CameraSlash: CameraSlashIcon,
  CaretDoubleDown: CaretDoubleDownIcon,
  CaretDown: CaretDownIcon,
  CaretLeft: CaretLeftIcon,
  CaretRight: CaretRightIcon,
  ChatCircle: ChatCircleIcon,
  Check: CheckIcon,
  CheckCircle: CheckCircleIcon,
  Circle: CircleIcon,
  Clock: ClockIcon,
  Compass: CompassIcon,
  Cpu: CpuIcon,
  Crosshair: CrosshairIcon,
  CubeFocus: CubeFocusIcon,
  CubeTransparent: CubeTransparentIcon,
  DeviceMobile: DeviceMobileIcon,
  Envelope: EnvelopeIcon,
  Eye: EyeIcon,
  EyeSlash: EyeSlashIcon,
  FileText: FileTextIcon,
  Flag: FlagIcon,
  Gear: GearIcon,
  Globe: GlobeIcon,
  GridFour: GridFourIcon,
  House: HouseIcon,
  Image: ImageIcon,
  Info: InfoIcon,
  Key: KeyIcon,
  Lightning: LightningIcon,
  List: ListIcon,
  Lock: LockIcon,
  MagnifyingGlass: MagnifyingGlassIcon,
  MagnifyingGlassMinus: MagnifyingGlassMinusIcon,
  MagnifyingGlassPlus: MagnifyingGlassPlusIcon,
  MapPin: MapPinIcon,
  MapTrifold: MapTrifoldIcon,
  Medal: MedalIcon,
  Minus: MinusIcon,
  Moon: MoonIcon,
  NavigationArrow: NavigationArrowIcon,
  Package: PackageIcon,
  PaperPlaneTilt: PaperPlaneTiltIcon,
  Pause: PauseIcon,
  PencilSimple: PencilSimpleIcon,
  Phone: PhoneIcon,
  Plus: PlusIcon,
  Prohibit: ProhibitIcon,
  Question: QuestionIcon,
  ShareNetwork: ShareNetworkIcon,
  ShieldCheck: ShieldCheckIcon,
  SignOut: SignOutIcon,
  Sparkle: SparkleIcon,
  SpeakerX: SpeakerXIcon,
  Star: StarIcon,
  Sun: SunIcon,
  Tag: TagIcon,
  Target: TargetIcon,
  ThumbsDown: ThumbsDownIcon,
  ThumbsUp: ThumbsUpIcon,
  Trash: TrashIcon,
  Tray: TrayIcon,
  Truck: TruckIcon,
  User: UserIcon,
  UserMinus: UserMinusIcon,
  Users: UsersIcon,
  Warning: WarningIcon,
  WarningCircle: WarningCircleIcon,
  WifiSlash: WifiSlashIcon,
  X: XIcon,
  XCircle: XCircleIcon,
};

// Feather (and the few stragglers) → Phosphor. Keys are the names used across
// the app and stored in the database; values are Phosphor component names.
const MAP = {
  // navigation & chrome
  "home":              "House",
  "grid":              "GridFour",
  "search":            "MagnifyingGlass",
  "menu":              "List",
  "x":                 "X",
  "x-circle":          "XCircle",
  "check":             "Check",
  "check-circle":      "CheckCircle",
  "circle":            "Circle",
  "chevron-left":      "CaretLeft",
  "chevron-right":     "CaretRight",
  "chevron-down":      "CaretDown",
  "chevrons-down":     "CaretDoubleDown",
  "arrow-left":        "ArrowLeft",
  "arrow-up-right":    "ArrowUpRight",
  "arrow-right-circle":"ArrowCircleRight",
  "plus":              "Plus",
  "minus":             "Minus",
  "pause":             "Pause",
  "refresh-cw":        "ArrowsClockwise",

  // places & travel
  "map":               "MapTrifold",
  "map-pin":           "MapPin",
  "navigation":        "NavigationArrow",
  "navigation-2":      "NavigationArrow",
  "compass":           "Compass",
  "globe":             "Globe",
  "truck":             "Truck",
  "crosshair":         "Crosshair",

  // content
  "book":              "Book",
  "book-open":         "BookOpen",
  "file-text":         "FileText",
  "image":             "Image",
  "tag":               "Tag",
  "calendar":          "Calendar",
  "clock":             "Clock",
  "box":               "Package",
  "inbox":             "Tray",
  "target":            "Target",

  // people & account
  "user":              "User",
  "users":             "Users",
  "user-x":            "UserMinus",
  "edit-2":            "PencilSimple",
  "log-out":           "SignOut",
  "key":               "Key",
  "lock":              "Lock",
  "shield":            "ShieldCheck",
  "mail":              "Envelope",
  "phone":             "Phone",
  "settings":          "Gear",
  "bell":              "Bell",

  // status & feedback
  "star":              "Star",
  "award":             "Medal",
  "flag":              "Flag",
  "bookmark":          "BookmarkSimple",
  "info":              "Info",
  "help-circle":       "Question",
  "alert-circle":      "WarningCircle",
  "alert-triangle":    "Warning",
  "slash":             "Prohibit",
  "wifi-off":          "WifiSlash",
  "volume-x":          "SpeakerX",
  "zap":               "Lightning",
  "thumbs-up":         "ThumbsUp",
  "thumbs-down":       "ThumbsDown",
  "message-square":    "ChatCircle",
  "send":              "PaperPlaneTilt",
  "share-2":           "ShareNetwork",
  "trash-2":           "Trash",

  // camera / AR / media
  "camera":            "Camera",
  "camera-off":        "CameraSlash",
  "aperture":          "Aperture",
  "cpu":               "Cpu",
  "eye":               "Eye",
  "eye-off":           "EyeSlash",
  "maximize":          "ArrowsOut",
  "zoom-in":           "MagnifyingGlassPlus",
  "zoom-out":          "MagnifyingGlassMinus",

  // appearance
  "sun":               "Sun",
  "moon":              "Moon",
  "smartphone":        "DeviceMobile",

  // stragglers from the families this replaces
  "stars":             "Sparkle",           // was MaterialIcons "stars"
  "cube-scan":         "CubeFocus",         // was MaterialCommunityIcons
  "image-outline":     "Image",             // was MaterialCommunityIcons
  "rotate-3d-variant": "CubeTransparent",   // was MaterialCommunityIcons
};

// Anything unmapped (e.g. a category an admin files under a name we've never
// seen) renders as a neutral pin rather than crashing or rendering nothing.
const FALLBACK = "MapPin";

// Phosphor renders real SVG rather than a glyph from an icon font, so these are
// slightly more expensive per node than the old <Feather>. memo() matters here
// because icons sit inside virtualized rows (the badge grid, leaderboard rows,
// mission lists) that re-render on every scroll tick — and every prop passed in
// is a primitive, so the shallow compare is exact.
function Icon({ name, size = 20, color, weight = "regular", style, ...rest }) {
  const key = MAP[name] ?? FALLBACK;

  if (__DEV__ && name && !MAP[name]) {
    console.warn(
      `[Icon] Unmapped icon name "${name}" — falling back to "${FALLBACK}". ` +
      `Add it to the MAP in components/Icon.js.`
    );
  }

  const Cmp = PH[key] ?? PH[FALLBACK];
  return <Cmp size={size} color={color} weight={weight} style={style} {...rest} />;
}

export default React.memo(Icon);

// Lets callers check a backend-supplied name before rendering.
export const hasIcon = (name) => Boolean(MAP[name]);
