import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from json_utils import write_json


class WriteJsonTests(unittest.TestCase):
    def test_creates_parent_and_writes_utf8_json(self):
        with TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / 'nested' / 'catalog.json'

            write_json(output, {'nome': 'drago rosso'})

            self.assertEqual(json.loads(output.read_text(encoding='utf-8')), {'nome': 'drago rosso'})
            self.assertTrue(output.read_bytes().endswith(b'\n'))

    def test_serialization_error_preserves_existing_output(self):
        with TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / 'catalog.json'
            output.write_text('precedente', encoding='utf-8')

            with self.assertRaises(TypeError):
                write_json(output, {'non serializzabile': object()})

            self.assertEqual(output.read_text(encoding='utf-8'), 'precedente')


if __name__ == '__main__':
    unittest.main()
