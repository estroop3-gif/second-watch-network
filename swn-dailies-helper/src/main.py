"""
SWN Dailies Helper - Main entry point
Desktop app for offloading footage, generating proxies, and uploading to cloud.
"""
import sys
import logging
import threading
from pathlib import Path
from datetime import datetime

from PyQt6.QtWidgets import QApplication, QStyleFactory
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QPalette, QColor

from src.services.local_server import start_local_server, stop_local_server
from src.ui.main_window import MainWindow
from src.version import __version__


def setup_logging():
    """Configure logging to file and console."""
    # Create logs directory in user's home
    if sys.platform == "win32":
        log_dir = Path.home() / "AppData" / "Local" / "SWN-Dailies-Helper" / "logs"
    else:
        log_dir = Path.home() / ".swn-dailies-helper" / "logs"

    log_dir.mkdir(parents=True, exist_ok=True)

    # Log file with date
    log_file = log_dir / f"swn-helper-{datetime.now().strftime('%Y-%m-%d')}.log"

    # Configure root logger
    logger = logging.getLogger("swn-helper")
    logger.setLevel(logging.DEBUG)

    # File handler - detailed
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(file_formatter)

    # Console handler - info and above
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter("[%(levelname)s] %(message)s")
    console_handler.setFormatter(console_formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    logger.info(f"=== SWN Dailies Helper v{__version__} starting ===")
    logger.info(f"Log file: {log_file}")

    return log_file


def main():
    """Main entry point for the SWN Dailies Helper app."""
    # Setup logging first
    log_file = setup_logging()
    logger = logging.getLogger("swn-helper")

    # Enable high DPI scaling
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    app = QApplication(sys.argv)
    app.setApplicationName("SWN Dailies Helper")
    app.setOrganizationName("Second Watch Network")
    app.setOrganizationDomain("secondwatchnetwork.com")

    # Use Fusion style for consistent cross-platform look and proper palette support
    app.setStyle(QStyleFactory.create("Fusion"))

    # Start the local HTTP server in a background thread
    server_thread = threading.Thread(target=start_local_server, daemon=True)
    server_thread.start()

    # Create and show main window
    window = MainWindow()
    window.show()

    # Run the app
    exit_code = app.exec()

    # Cleanup
    stop_local_server()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
