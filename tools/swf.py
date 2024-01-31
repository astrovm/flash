#!/usr/bin/env python3
import argparse
from os.path import splitext
from struct import unpack


def main():
    parser = argparse.ArgumentParser(description="Extract Flash application from file")
    parser.add_argument("file", help="Input file")
    args = parser.parse_args()

    with open(args.file, "rb") as file:
        file_type = file.read(4)
        file.seek(-8, 2)
        if file_type == b"Joy!":  # Mac
            file_size, file_type = unpack(">II", file.read(8))
        elif file_type[:2] == b"MZ":  # Win
            file_type, file_size = unpack("<II", file.read(8))
        else:
            exit(1)

        assert file_type == 0xFA123456, "Probably not a Flash application"
        file.seek(-(file_size + 8), 2)
        output_file_path = splitext(args.file)[0] + ".swf"
        with open(output_file_path, "wb") as output_file:
            output_file.write(file.read(file_size))


if __name__ == "__main__":
    main()
