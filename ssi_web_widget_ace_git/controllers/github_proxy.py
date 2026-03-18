# Copyright 2026 OpenSynergy Indonesia
# Copyright 2026 PT. Simetri Sinergi Indonesia
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
import logging
import re
from urllib.parse import urlparse

import requests

from odoo import http

_logger = logging.getLogger(__name__)

# Allowlist of GitHub domains - prevents SSRF attacks by restricting
# outbound requests to known GitHub infrastructure only.
_ALLOWED_HOSTS = frozenset(
    [
        "raw.githubusercontent.com",
        "github.com",
        "api.github.com",
    ]
)


class GitHubProxyController(http.Controller):
    """Backend proxy controller for fetching GitHub file content.

    The browser cannot directly call GitHub's API due to CORS restrictions,
    so the JavaScript widget forwards the request here instead.
    All requests are authenticated (auth='user') and restricted to GitHub
    domains to prevent misuse.
    """

    @http.route(
        "/ssi_web_widget_ace_git/fetch_github",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def fetch_github_content(self, github_url="", github_token="", **kwargs):
        """Proxy a request to GitHub and return the raw file content.

        :param str github_url: GitHub file URL (web URL or raw URL).
        :param str github_token: Optional GitHub Personal Access Token.
        :returns: dict with keys 'content' (str or None) and 'error' (str or None).
        """
        github_url = (github_url or "").strip()
        github_token = (github_token or "").strip()

        if not github_url:
            return {"content": None, "error": "GitHub URL must not be empty."}

        raw_url = self._convert_to_raw_url(github_url)
        if not raw_url:
            return {
                "content": None,
                "error": (
                    "Invalid URL. Please enter a valid GitHub file URL, "
                    "e.g. https://github.com/user/repo/blob/main/file.py"
                ),
            }

        # SSRF protection: only allow requests to GitHub domains.
        if not self._is_allowed_url(raw_url):
            return {
                "content": None,
                "error": (
                    "This URL is not allowed. "
                    "Only URLs from github.com are permitted."
                ),
            }

        headers = {
            # Request raw content when using the API endpoint
            "Accept": "application/vnd.github.v3.raw",
        }
        if github_token:
            headers["Authorization"] = "token %s" % github_token

        try:
            response = requests.get(raw_url, headers=headers, timeout=15)
        except requests.exceptions.Timeout:
            return {
                "content": None,
                "error": "Request timed out. Please try again.",
            }
        except requests.exceptions.ConnectionError:
            return {
                "content": None,
                "error": "Failed to connect to GitHub. Please check your internet connection.",
            }
        except Exception:
            _logger.exception(
                "Unexpected error while fetching from GitHub URL: %s", raw_url
            )
            return {"content": None, "error": "An unexpected error occurred."}

        if response.status_code == 200:
            return {"content": response.text, "error": None}
        elif response.status_code == 401:
            return {
                "content": None,
                "error": (
                    "Authentication failed. "
                    "Please check your GitHub Personal Access Token."
                ),
            }
        elif response.status_code == 403:
            return {
                "content": None,
                "error": (
                    "Access denied. The token does not have the required permissions, "
                    "or you have exceeded the GitHub rate limit."
                ),
            }
        elif response.status_code == 404:
            return {
                "content": None,
                "error": (
                    "File not found (404). Please double-check the URL "
                    "and ensure the repository, branch, and path are correct."
                ),
            }
        else:
            return {
                "content": None,
                "error": "GitHub returned HTTP status %s." % response.status_code,
            }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _convert_to_raw_url(self, url):
        """Convert various GitHub URL formats to a fetchable raw content URL.

        Supported inputs:
        - https://github.com/user/repo/blob/branch/path/to/file  → raw URL
        - https://raw.githubusercontent.com/...                  → returned as-is
        - https://api.github.com/repos/...                        → returned as-is

        :param str url: Input URL.
        :returns: str raw URL, or None if the URL is not recognised.
        """
        # Already a raw content URL
        if url.startswith("https://raw.githubusercontent.com/"):
            return url

        # GitHub web URL: /blob/ form
        match = re.match(
            r"https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.*)",
            url,
        )
        if match:
            user, repo, branch, path = match.groups()
            return "https://raw.githubusercontent.com/%s/%s/%s/%s" % (
                user,
                repo,
                branch,
                path,
            )

        # GitHub REST API URL – accepted as-is; the Accept header above
        # will cause it to return raw content.
        if url.startswith("https://api.github.com/"):
            return url

        return None

    def _is_allowed_url(self, url):
        """Return True only if the URL hostname is in the GitHub allowlist."""
        try:
            parsed = urlparse(url)
            if parsed.scheme != "https":
                return False
            hostname = parsed.hostname or ""
            return hostname in _ALLOWED_HOSTS
        except Exception:
            return False
