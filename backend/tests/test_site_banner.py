import unittest

from app.models.site_banner import SiteBannerImage


class SiteBannerImageTests(unittest.TestCase):
    def test_image_url_changes_when_sqlite_reuses_an_id(self):
        old_image = SiteBannerImage(
            id=1,
            image_path="data/uploads/banners/old-file-token.png",
            image_name="old.png",
        )
        replacement_image = SiteBannerImage(
            id=1,
            image_path="data/uploads/banners/new-file-token.png",
            image_name="new.png",
        )

        self.assertEqual(
            old_image.public_url,
            "/api/v1/banner/images/1?v=old-file-token",
        )
        self.assertEqual(
            replacement_image.public_url,
            "/api/v1/banner/images/1?v=new-file-token",
        )
        self.assertNotEqual(old_image.public_url, replacement_image.public_url)


if __name__ == "__main__":
    unittest.main()
