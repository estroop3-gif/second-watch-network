"""
SWN Dailies Helper - Main entry point
Desktop app for offloading footage, generating proxies, and uploading to cloud.
"""
import sys
import threading
from pathlib import Path

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt

from src.services.local_server import start_local_server, stop_local_server
from src.ui.main_window import MainWindow


def main():
    """Main entry point for the SWN Dailies Helper app."""
    # Enable high DPI scaling
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    app = QApplication(sys.argv)
    app.setApplicationName("SWN Dailies Helper")
    app.setOrganizationName("Second Watch Network")
    app.setOrganizationDomain("secondwatchnetwork.com")

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
