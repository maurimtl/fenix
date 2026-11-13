"""Company-board lookup, kept under its old name: `python3 boards.py <slug>[:board[:extra]] ...` prints one
company's senior product, growth and AI roles with their board id, posting date and pay, and writes them to
$OUT (default boards.json). With no arguments it runs the full scan. Everything lives in scan.py."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from scan import main

if __name__ == "__main__":
    main()
