"""Regression tests for the author-person rule in check-docs.py."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("check_docs", ROOT / "scripts/check-docs.py")
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


class AuthorPersonTests(unittest.TestCase):
    def check_page(self, frontmatter, registry):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blog = root / "blog"
            blog.mkdir()
            (blog / "authors.yml").write_text(registry)
            post = blog / "post.md"
            post.write_text(f"---\n{frontmatter}---\n\n# Post\n")
            return checks.author_person_errors([str(post)], repo_root=str(root))

    def test_a_post_without_authors_is_rejected(self):
        errors = self.check_page("title: Post\n", "person:\n  name: A Person\n")
        self.assertIn(("author-person", "blog/post.md", 1, "post or release note has no authors"), errors)

    def test_a_post_with_an_empty_authors_list_is_rejected(self):
        errors = self.check_page("authors: []\n", "person:\n  name: A Person\n")
        self.assertIn(("author-person", "blog/post.md", 1, "post or release note has no authors"), errors)

    def test_an_unknown_author_key_is_rejected(self):
        errors = self.check_page("authors:\n  - missing\n", "person:\n  name: A Person\n")
        self.assertTrue(any("author key `missing` is missing" in error[3] for error in errors))

    def test_a_team_author_key_and_registry_entry_are_rejected(self):
        errors = self.check_page("authors:\n  - team\n", "team:\n  name: Example Team\n")
        self.assertTrue(any(error[1] == "blog/post.md" and "resolves to team" in error[3] for error in errors))
        self.assertTrue(any(error[1] == "blog/authors.yml" and "team or company byline" in error[3] for error in errors))

    def test_a_person_author_key_passes(self):
        errors = self.check_page("authors:\n  - person\n", "person:\n  name: A Person\n")
        self.assertEqual(errors, [])

    def test_an_inline_author_with_a_name_passes(self):
        errors = self.check_page("authors:\n  - name: A Person\n", "{}\n")
        self.assertEqual(errors, [])

    def test_the_plugin_index_page_is_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blog = root / "blog"
            blog.mkdir()
            (blog / "authors.yml").write_text("team:\n  name: Example Team\n")
            index = blog / "index.md"
            index.write_text("---\ntitle: Blog\n---\n")
            self.assertEqual(checks.author_person_errors([str(index)], repo_root=str(root)), [])


if __name__ == "__main__":
    unittest.main()
