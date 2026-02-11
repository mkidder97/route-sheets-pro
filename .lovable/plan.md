

# Clean Up RouteBuilder and Sidebar

## 1. Remove SavedRoutes from RouteBuilder (`src/pages/RouteBuilder.tsx`)

- Delete line 39: `import SavedRoutes from "@/components/SavedRoutes";`
- Delete lines 524-525: the `<SavedRoutes />` render and its comment

## 2. Update "done" step buttons (lines 512-519)

Replace both buttons with:
- "Create Another Plan" -- same reset logic, goes to `"params"`
- "View in My Routes" -- calls `navigate("/")` (useNavigate already imported on line 2)

## 3. Remove unused imports

**Line 10**: Delete `import { Progress } from "@/components/ui/progress";`

**Line 11**: Delete `import { Textarea } from "@/components/ui/textarea";`

**Lines 19-25**: Delete the entire Dialog import block

**Lines 26-35**: Delete the entire AlertDialog import block

**Line 38**: Change from:
```
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, AlertTriangle, GripVertical, X, Navigation, ChevronDown, ChevronUp, Eye } from "lucide-react";
```
To:
```
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, AlertTriangle, GripVertical, X, Navigation } from "lucide-react";
```

## 4. Remove unused constants (lines 45-59)

Delete `STATUS_CONFIG` and `STATUS_CYCLE` -- only referenced by the now-removed SavedRoutes inline rendering.

## 5. Remove Upload from sidebar (`src/components/AppSidebar.tsx`)

- Line 1: Remove `Upload` from the lucide-react import
- Line 18: Delete the Upload entry from `mainNav`
- Final `mainNav` order: My Routes, Route Builder, Settings (3 items)

## What stays untouched
- `src/pages/Upload.tsx` file and `/upload` route in App.tsx
- `src/components/SavedRoutes.tsx` (still used by MyRoutes)
- All route generation logic, BuildingRow component, drag-and-drop

