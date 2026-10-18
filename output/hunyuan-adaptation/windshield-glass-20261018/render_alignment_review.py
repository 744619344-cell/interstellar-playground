"""Additional unchanged, reproducible exterior review viewpoints."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_review import VIEWS, main
VIEWS.update({
    'quarter-right': ((12, 15, 7), (0, 2, 0), 11),
    'back': ((0, -22, 5), (0, 0, 0), 19),
    'bottom': ((0, 3, -21), (0, 1, 0), 19),
})
if __name__ == '__main__':
    main()
