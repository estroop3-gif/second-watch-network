"""
Report Generator - Generate offload and QC reports in PDF and CSV formats.

Reports:
- Card offload report (PDF)
- Clip metadata list (CSV)
- Day summary report (PDF)
- QC summary report (PDF)
"""
import csv
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from src.services.metadata_extractor import ClipMetadata
from src.services.qc_checker import QCResult, QCSummary
from src.services.card_fingerprint import CardFingerprint, OffloadRecord


@dataclass
class OffloadReportData:
    """Data for an offload report."""
    card_label: str
    fingerprint: str
    offload_date: datetime
    destinations: List[str]
    total_clips: int
    total_size: int
    total_duration: float
    clips: List[ClipMetadata]
    qc_summary: Optional[QCSummary]
    qc_results: Optional[List[QCResult]]


class ReportGenerator:
    """Generate reports in PDF and CSV formats."""

    def __init__(self, output_dir: Optional[str] = None):
        """
        Initialize the report generator.

        Args:
            output_dir: Directory for output files. Defaults to user's Documents.
        """
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            self.output_dir = Path.home() / "Documents" / "SWN Reports"

        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_offload_report_txt(self, data: OffloadReportData) -> str:
        """
        Generate a text-based offload report.

        Args:
            data: Report data

        Returns:
            Path to generated report file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"offload_report_{data.card_label}_{timestamp}.txt"
        filepath = self.output_dir / filename

        lines = [
            "=" * 70,
            "CARD OFFLOAD REPORT",
            "=" * 70,
            "",
            f"Card Label:      {data.card_label}",
            f"Fingerprint:     {data.fingerprint[:16]}...",
            f"Offload Date:    {data.offload_date.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "DESTINATIONS:",
            "-" * 40,
        ]

        for dest in data.destinations:
            lines.append(f"  - {dest}")

        lines.extend([
            "",
            "SUMMARY:",
            "-" * 40,
            f"Total Clips:     {data.total_clips}",
            f"Total Size:      {self._format_size(data.total_size)}",
            f"Total Duration:  {self._format_duration(data.total_duration)}",
            "",
        ])

        # QC Summary if available
        if data.qc_summary:
            lines.extend([
                "QC SUMMARY:",
                "-" * 40,
                f"Passed:          {data.qc_summary.passed}",
                f"Warnings:        {data.qc_summary.warnings}",
                f"Failed:          {data.qc_summary.failed}",
                "",
            ])

            if data.qc_summary.flags_by_type:
                lines.append("Issues by Type:")
                for flag_type, count in data.qc_summary.flags_by_type.items():
                    lines.append(f"  {flag_type}: {count}")
                lines.append("")

        # Clip List
        lines.extend([
            "CLIP LIST:",
            "-" * 70,
            f"{'Filename':<40} {'Duration':>10} {'Resolution':>12} {'Size':>12}",
            "-" * 70,
        ])

        for clip in data.clips:
            lines.append(
                f"{clip.filename[:40]:<40} "
                f"{self._format_duration(clip.duration_seconds):>10} "
                f"{clip.resolution:>12} "
                f"{self._format_size(clip.file_size):>12}"
            )

        lines.extend([
            "",
            "-" * 70,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "SWN Dailies Helper",
            "=" * 70,
        ])

        with open(filepath, "w") as f:
            f.write("\n".join(lines))

        return str(filepath)

    def generate_clip_list_csv(
        self,
        clips: List[ClipMetadata],
        card_label: str = "clips"
    ) -> str:
        """
        Generate a CSV file with clip metadata.

        Args:
            clips: List of clip metadata
            card_label: Label for the filename

        Returns:
            Path to generated CSV file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"clip_list_{card_label}_{timestamp}.csv"
        filepath = self.output_dir / filename

        fieldnames = [
            "filename",
            "reel",
            "clip_number",
            "duration_seconds",
            "resolution",
            "fps",
            "codec",
            "audio_channels",
            "timecode_start",
            "color_space",
            "camera_make",
            "file_size",
            "file_path",
        ]

        with open(filepath, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for clip in clips:
                writer.writerow({
                    "filename": clip.filename,
                    "reel": clip.reel or "",
                    "clip_number": clip.clip_number or "",
                    "duration_seconds": f"{clip.duration_seconds:.2f}",
                    "resolution": clip.resolution,
                    "fps": f"{clip.fps:.3f}",
                    "codec": clip.codec,
                    "audio_channels": clip.audio_channels,
                    "timecode_start": clip.timecode_start or "",
                    "color_space": clip.color_space or "",
                    "camera_make": clip.camera_make or "",
                    "file_size": clip.file_size,
                    "file_path": clip.file_path,
                })

        return str(filepath)

    def generate_qc_report_txt(
        self,
        qc_results: List[QCResult],
        qc_summary: QCSummary,
        card_label: str = "qc"
    ) -> str:
        """
        Generate a text-based QC report.

        Args:
            qc_results: List of QC results
            qc_summary: QC summary
            card_label: Label for the filename

        Returns:
            Path to generated report file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"qc_report_{card_label}_{timestamp}.txt"
        filepath = self.output_dir / filename

        lines = [
            "=" * 70,
            "QC REPORT",
            "=" * 70,
            "",
            f"Card Label:      {card_label}",
            f"Report Date:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "SUMMARY:",
            "-" * 40,
            f"Total Clips:     {qc_summary.total_clips}",
            f"Passed:          {qc_summary.passed}",
            f"Warnings:        {qc_summary.warnings}",
            f"Failed:          {qc_summary.failed}",
            "",
        ]

        if qc_summary.flags_by_type:
            lines.append("Issues by Type:")
            for flag_type, count in sorted(qc_summary.flags_by_type.items()):
                lines.append(f"  {flag_type}: {count}")
            lines.append("")

        # Failed clips
        failed = [r for r in qc_results if r.status == "fail"]
        if failed:
            lines.extend([
                "FAILED CLIPS:",
                "-" * 40,
            ])
            for result in failed:
                lines.append(f"\n{result.clip_filename}")
                for flag in result.flags:
                    lines.append(f"  [{flag.severity.upper()}] {flag.message}")
            lines.append("")

        # Warning clips
        warnings = [r for r in qc_results if r.status == "warning"]
        if warnings:
            lines.extend([
                "CLIPS WITH WARNINGS:",
                "-" * 40,
            ])
            for result in warnings:
                lines.append(f"\n{result.clip_filename}")
                for flag in result.flags:
                    lines.append(f"  [{flag.severity.upper()}] {flag.message}")
            lines.append("")

        # Passed clips summary
        passed = [r for r in qc_results if r.status == "pass"]
        if passed:
            lines.extend([
                "PASSED CLIPS:",
                "-" * 40,
            ])
            for result in passed:
                lines.append(f"  {result.clip_filename}")
            lines.append("")

        lines.extend([
            "=" * 70,
            "SWN Dailies Helper",
            "=" * 70,
        ])

        with open(filepath, "w") as f:
            f.write("\n".join(lines))

        return str(filepath)

    def generate_day_summary_txt(
        self,
        shoot_date: datetime,
        offloads: List[OffloadReportData],
    ) -> str:
        """
        Generate a day summary report.

        Args:
            shoot_date: The shoot date
            offloads: List of offload data for the day

        Returns:
            Path to generated report file
        """
        date_str = shoot_date.strftime("%Y%m%d")
        filename = f"day_summary_{date_str}.txt"
        filepath = self.output_dir / filename

        total_clips = sum(o.total_clips for o in offloads)
        total_size = sum(o.total_size for o in offloads)
        total_duration = sum(o.total_duration for o in offloads)

        lines = [
            "=" * 70,
            "DAY SUMMARY REPORT",
            "=" * 70,
            "",
            f"Shoot Date:      {shoot_date.strftime('%Y-%m-%d')}",
            f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "OVERALL TOTALS:",
            "-" * 40,
            f"Cards Offloaded: {len(offloads)}",
            f"Total Clips:     {total_clips}",
            f"Total Size:      {self._format_size(total_size)}",
            f"Total Duration:  {self._format_duration(total_duration)}",
            "",
            "CARDS:",
            "-" * 70,
        ]

        for offload in offloads:
            lines.extend([
                f"\n{offload.card_label}",
                f"  Clips:    {offload.total_clips}",
                f"  Size:     {self._format_size(offload.total_size)}",
                f"  Duration: {self._format_duration(offload.total_duration)}",
                f"  Time:     {offload.offload_date.strftime('%H:%M:%S')}",
            ])

            if offload.qc_summary:
                lines.append(
                    f"  QC:       {offload.qc_summary.passed} passed, "
                    f"{offload.qc_summary.warnings} warnings, "
                    f"{offload.qc_summary.failed} failed"
                )

        lines.extend([
            "",
            "=" * 70,
            "SWN Dailies Helper",
            "=" * 70,
        ])

        with open(filepath, "w") as f:
            f.write("\n".join(lines))

        return str(filepath)

    def generate_checksum_manifest(
        self,
        clips: List[Dict[str, Any]],
        card_label: str
    ) -> str:
        """
        Generate a checksum manifest file.

        Args:
            clips: List of dicts with 'filename', 'path', and 'xxh64' keys
            card_label: Card label for filename

        Returns:
            Path to generated manifest file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"checksum_manifest_{card_label}_{timestamp}.txt"
        filepath = self.output_dir / filename

        lines = [
            f"# Checksum Manifest - {card_label}",
            f"# Generated: {datetime.now().isoformat()}",
            f"# Algorithm: XXH64",
            "",
        ]

        for clip in clips:
            lines.append(f"{clip.get('xxh64', 'N/A')}  {clip.get('filename', 'unknown')}")

        with open(filepath, "w") as f:
            f.write("\n".join(lines))

        return str(filepath)

    def _format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable string."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"

    def _format_duration(self, seconds: float) -> str:
        """Format seconds to HH:MM:SS."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)

        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"
