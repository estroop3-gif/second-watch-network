"""
OpenTimelineIO service for timeline parsing and manipulation.

Provides functionality for:
- Reading EDL, XML, AAF, and OTIO timeline files
- Extracting clip references with in/out points
- Finding missing media files
- Generating proxy timelines
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from enum import Enum

try:
    import opentimelineio as otio
    HAS_OTIO = True
except ImportError:
    HAS_OTIO = False


class TimelineFormat(Enum):
    """Supported timeline formats."""
    OTIO = "otio"
    EDL = "edl"
    FCPXML = "fcpxml"
    AAF = "aaf"
    UNKNOWN = "unknown"


@dataclass
class RationalTime:
    """Simple rational time representation."""
    value: float
    rate: float

    @classmethod
    def from_otio(cls, time) -> "RationalTime":
        """Create from OTIO RationalTime."""
        if time is None:
            return cls(0.0, 24.0)
        return cls(float(time.value), float(time.rate))

    def to_seconds(self) -> float:
        """Convert to seconds."""
        if self.rate == 0:
            return 0.0
        return self.value / self.rate

    def to_timecode(self) -> str:
        """Convert to SMPTE timecode string."""
        if self.rate == 0:
            return "00:00:00:00"
        total_frames = int(self.value)
        fps = int(self.rate)
        frames = total_frames % fps
        total_seconds = total_frames // fps
        seconds = total_seconds % 60
        total_minutes = total_seconds // 60
        minutes = total_minutes % 60
        hours = total_minutes // 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}:{frames:02d}"


@dataclass
class ClipReference:
    """Reference to a clip in a timeline."""
    name: str
    source_path: Optional[str] = None
    in_point: Optional[RationalTime] = None
    out_point: Optional[RationalTime] = None
    duration: Optional[RationalTime] = None
    track_index: int = 0
    track_name: str = ""
    media_exists: bool = False
    reel_name: str = ""
    source_file_name: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration_seconds(self) -> float:
        """Get duration in seconds."""
        if self.duration:
            return self.duration.to_seconds()
        if self.in_point and self.out_point:
            return (self.out_point.value - self.in_point.value) / self.in_point.rate
        return 0.0


@dataclass
class TimelineInfo:
    """Information about a parsed timeline."""
    name: str
    path: str
    format: TimelineFormat
    duration: RationalTime
    frame_rate: float
    clips: List[ClipReference] = field(default_factory=list)
    video_tracks: int = 0
    audio_tracks: int = 0
    total_clips: int = 0
    missing_media_count: int = 0
    errors: List[str] = field(default_factory=list)

    @property
    def has_missing_media(self) -> bool:
        return self.missing_media_count > 0


class TimelineService:
    """
    Service for working with OpenTimelineIO.

    Provides timeline parsing, clip extraction, and proxy generation.
    """

    def __init__(self):
        self._available = HAS_OTIO

    @property
    def is_available(self) -> bool:
        """Check if OpenTimelineIO is available."""
        return self._available

    def get_supported_formats(self) -> List[str]:
        """Get list of supported timeline file extensions."""
        return [".otio", ".edl", ".xml", ".fcpxml", ".aaf"]

    def detect_format(self, path: str) -> TimelineFormat:
        """Detect the format of a timeline file."""
        p = Path(path)
        ext = p.suffix.lower()
        if ext == ".otio":
            return TimelineFormat.OTIO
        elif ext == ".edl":
            return TimelineFormat.EDL
        elif ext in (".xml", ".fcpxml"):
            return TimelineFormat.FCPXML
        elif ext == ".aaf":
            return TimelineFormat.AAF
        return TimelineFormat.UNKNOWN

    def read_timeline(self, path: str) -> Optional[TimelineInfo]:
        """
        Read a timeline file and extract information.

        Args:
            path: Path to timeline file (EDL, XML, AAF, or OTIO)

        Returns:
            TimelineInfo with clips and metadata, or None on error
        """
        if not self.is_available:
            return None

        file_path = Path(path)
        if not file_path.exists():
            return None

        format_type = self.detect_format(path)
        if format_type == TimelineFormat.UNKNOWN:
            return None

        try:
            timeline = otio.adapters.read_from_file(path)
            return self._parse_timeline(timeline, path, format_type)
        except Exception as e:
            info = TimelineInfo(
                name=file_path.stem,
                path=path,
                format=format_type,
                duration=RationalTime(0, 24),
                frame_rate=24.0
            )
            info.errors.append(str(e))
            return info

    def _parse_timeline(
        self,
        timeline,
        path: str,
        format_type: TimelineFormat
    ) -> TimelineInfo:
        """Parse an OTIO timeline object into TimelineInfo."""
        file_path = Path(path)

        # Get basic info
        name = timeline.name if hasattr(timeline, 'name') else file_path.stem
        frame_rate = 24.0

        # Get duration
        if hasattr(timeline, 'duration'):
            duration = RationalTime.from_otio(timeline.duration())
            if duration.rate > 0:
                frame_rate = duration.rate
        else:
            duration = RationalTime(0, frame_rate)

        info = TimelineInfo(
            name=name,
            path=path,
            format=format_type,
            duration=duration,
            frame_rate=frame_rate
        )

        # Count tracks
        if hasattr(timeline, 'video_tracks'):
            video_tracks = list(timeline.video_tracks())
            info.video_tracks = len(video_tracks)

            # Extract clips from video tracks
            for track_idx, track in enumerate(video_tracks):
                track_name = track.name if hasattr(track, 'name') else f"V{track_idx + 1}"
                self._extract_clips_from_track(
                    track, track_idx, track_name, info, file_path.parent
                )

        if hasattr(timeline, 'audio_tracks'):
            audio_tracks = list(timeline.audio_tracks())
            info.audio_tracks = len(audio_tracks)

        info.total_clips = len(info.clips)
        info.missing_media_count = sum(1 for c in info.clips if not c.media_exists)

        return info

    def _extract_clips_from_track(
        self,
        track,
        track_idx: int,
        track_name: str,
        info: TimelineInfo,
        base_path: Path
    ):
        """Extract clips from a track."""
        if not hasattr(track, 'each_clip'):
            return

        for clip in track.each_clip():
            clip_ref = self._extract_clip_reference(
                clip, track_idx, track_name, base_path
            )
            if clip_ref:
                info.clips.append(clip_ref)

    def _extract_clip_reference(
        self,
        clip,
        track_idx: int,
        track_name: str,
        base_path: Path
    ) -> Optional[ClipReference]:
        """Extract a ClipReference from an OTIO clip."""
        try:
            name = clip.name if hasattr(clip, 'name') else ""

            # Get source range (in/out points)
            in_point = None
            out_point = None
            duration = None

            if hasattr(clip, 'source_range') and clip.source_range:
                sr = clip.source_range
                if hasattr(sr, 'start_time'):
                    in_point = RationalTime.from_otio(sr.start_time)
                if hasattr(sr, 'duration'):
                    duration = RationalTime.from_otio(sr.duration)
                    if in_point:
                        out_value = in_point.value + duration.value
                        out_point = RationalTime(out_value, in_point.rate)

            # Get source path from media reference
            source_path = None
            source_file_name = ""
            reel_name = ""

            if hasattr(clip, 'media_reference') and clip.media_reference:
                mr = clip.media_reference
                if hasattr(mr, 'target_url'):
                    source_path = mr.target_url
                    if source_path:
                        # Handle file:// URLs
                        if source_path.startswith("file://"):
                            source_path = source_path[7:]
                        source_file_name = Path(source_path).name
                if hasattr(mr, 'name') and mr.name:
                    reel_name = mr.name

            # Check if media exists
            media_exists = False
            if source_path:
                sp = Path(source_path)
                if sp.is_absolute():
                    media_exists = sp.exists()
                else:
                    # Try relative to timeline
                    media_exists = (base_path / sp).exists()

            # Get metadata
            metadata = {}
            if hasattr(clip, 'metadata') and clip.metadata:
                metadata = dict(clip.metadata)

            return ClipReference(
                name=name,
                source_path=source_path,
                in_point=in_point,
                out_point=out_point,
                duration=duration,
                track_index=track_idx,
                track_name=track_name,
                media_exists=media_exists,
                reel_name=reel_name,
                source_file_name=source_file_name,
                metadata=metadata
            )

        except Exception as e:
            return None

    def find_missing_media(
        self,
        timeline_info: TimelineInfo,
        search_paths: List[str]
    ) -> Dict[str, Optional[str]]:
        """
        Find missing media files by searching in specified paths.

        Args:
            timeline_info: Parsed timeline info
            search_paths: List of directories to search for media

        Returns:
            Dict mapping original path to found path (or None if not found)
        """
        results = {}

        for clip in timeline_info.clips:
            if clip.media_exists or not clip.source_file_name:
                continue

            found_path = None
            for search_dir in search_paths:
                search_path = Path(search_dir)
                if not search_path.exists():
                    continue

                # Try direct match
                candidate = search_path / clip.source_file_name
                if candidate.exists():
                    found_path = str(candidate)
                    break

                # Try recursive search
                for match in search_path.rglob(clip.source_file_name):
                    found_path = str(match)
                    break

                if found_path:
                    break

            results[clip.source_path or clip.source_file_name] = found_path

        return results

    def relink_media(
        self,
        timeline_info: TimelineInfo,
        relink_map: Dict[str, str]
    ) -> TimelineInfo:
        """
        Create a new timeline info with relinked media paths.

        Args:
            timeline_info: Original timeline info
            relink_map: Dict mapping old paths to new paths

        Returns:
            New TimelineInfo with updated paths
        """
        # Create a copy with updated clips
        new_clips = []
        for clip in timeline_info.clips:
            old_path = clip.source_path or clip.source_file_name
            new_path = relink_map.get(old_path)

            if new_path:
                new_clip = ClipReference(
                    name=clip.name,
                    source_path=new_path,
                    in_point=clip.in_point,
                    out_point=clip.out_point,
                    duration=clip.duration,
                    track_index=clip.track_index,
                    track_name=clip.track_name,
                    media_exists=Path(new_path).exists(),
                    reel_name=clip.reel_name,
                    source_file_name=Path(new_path).name,
                    metadata=clip.metadata
                )
                new_clips.append(new_clip)
            else:
                new_clips.append(clip)

        new_info = TimelineInfo(
            name=timeline_info.name,
            path=timeline_info.path,
            format=timeline_info.format,
            duration=timeline_info.duration,
            frame_rate=timeline_info.frame_rate,
            clips=new_clips,
            video_tracks=timeline_info.video_tracks,
            audio_tracks=timeline_info.audio_tracks,
            total_clips=len(new_clips),
            missing_media_count=sum(1 for c in new_clips if not c.media_exists)
        )

        return new_info

    def generate_proxy_timeline(
        self,
        timeline_path: str,
        proxy_folder: str,
        proxy_suffix: str = "_proxy",
        proxy_extension: str = ".mp4"
    ) -> Optional[str]:
        """
        Generate a new timeline file with media paths pointing to proxy files.

        Args:
            timeline_path: Path to original timeline
            proxy_folder: Folder containing proxy files
            proxy_suffix: Suffix added to proxy filenames
            proxy_extension: Extension of proxy files

        Returns:
            Path to generated proxy timeline, or None on error
        """
        if not self.is_available:
            return None

        try:
            timeline = otio.adapters.read_from_file(timeline_path)
            proxy_path = Path(proxy_folder)

            # Update media references
            for clip in timeline.each_clip():
                if not hasattr(clip, 'media_reference') or not clip.media_reference:
                    continue

                mr = clip.media_reference
                if not hasattr(mr, 'target_url') or not mr.target_url:
                    continue

                original_path = mr.target_url
                if original_path.startswith("file://"):
                    original_path = original_path[7:]

                original = Path(original_path)
                proxy_name = original.stem + proxy_suffix + proxy_extension
                proxy_file = proxy_path / proxy_name

                if proxy_file.exists():
                    mr.target_url = f"file://{proxy_file}"

            # Write new timeline
            original = Path(timeline_path)
            output_path = original.parent / f"{original.stem}_proxy.otio"
            otio.adapters.write_to_file(timeline, str(output_path))

            return str(output_path)

        except Exception as e:
            return None

    def get_unique_sources(self, timeline_info: TimelineInfo) -> List[str]:
        """
        Get list of unique source file paths from a timeline.

        Args:
            timeline_info: Parsed timeline info

        Returns:
            List of unique source paths
        """
        sources = set()
        for clip in timeline_info.clips:
            if clip.source_path:
                sources.add(clip.source_path)
            elif clip.source_file_name:
                sources.add(clip.source_file_name)
        return sorted(sources)


# Singleton instance
_service: Optional[TimelineService] = None


def get_timeline_service() -> TimelineService:
    """Get the singleton timeline service instance."""
    global _service
    if _service is None:
        _service = TimelineService()
    return _service
