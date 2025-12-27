"""UI dialogs package."""
from src.ui.dialogs.connection_details import ConnectionDetailsDialog
from src.ui.dialogs.naming_convention_dialog import NamingConventionDialog
from src.ui.dialogs.backlot_link_dialog import BacklotLinkDialog
from src.ui.dialogs.offload_options_dialog import OffloadOptionsDialog
from src.ui.dialogs.preflight_dialog import PreFlightDialog
from src.ui.dialogs.media_inspector_dialog import MediaInspectorDialog
from src.ui.dialogs.remote_config_dialog import RemoteConfigDialog

__all__ = [
    "ConnectionDetailsDialog",
    "NamingConventionDialog",
    "BacklotLinkDialog",
    "OffloadOptionsDialog",
    "PreFlightDialog",
    "MediaInspectorDialog",
    "RemoteConfigDialog",
]
