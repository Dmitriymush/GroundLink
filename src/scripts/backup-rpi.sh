#!/bin/bash

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Default values
DEFAULT_BACKUP_DIR="/home/$SUDO_USER/rpi-backups"
SOURCE_DEVICE="/dev/mmcblk0"
DATE=$(date +%Y%m%d_%H%M%S)

# Help message
show_help() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -d, --directory DIR   Backup directory (default: $DEFAULT_BACKUP_DIR)"
    echo "  -s, --source DEV      Source device (default: $SOURCE_DEVICE)"
    echo "  -h, --help           Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--directory)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -s|--source)
            SOURCE_DEVICE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set backup directory if not specified
BACKUP_DIR=${BACKUP_DIR:-$DEFAULT_BACKUP_DIR}

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR" || {
        echo "Error: Failed to create backup directory: $BACKUP_DIR"
        exit 1
    }
fi

# Verify source device exists
if [ ! -b "$SOURCE_DEVICE" ]; then
    echo "Error: Source device not found: $SOURCE_DEVICE"
    echo "Available devices:"
    lsblk
    exit 1
fi

# Get device size
DEVICE_SIZE=$(blockdev --getsize64 "$SOURCE_DEVICE")
if [ $? -ne 0 ]; then
    echo "Error: Failed to get device size"
    exit 1
fi

# Set backup filename
BACKUP_FILE="$BACKUP_DIR/rpi_backup_$DATE.img"

echo "Starting backup..."
echo "Source device: $SOURCE_DEVICE"
echo "Backup file: $BACKUP_FILE"
echo "Device size: $(numfmt --to=iec-i --suffix=B $DEVICE_SIZE)"

# Create backup using dd with progress monitoring
dd if="$SOURCE_DEVICE" of="$BACKUP_FILE" bs=4M status=progress conv=fsync || {
    echo "Error: Backup failed"
    rm -f "$BACKUP_FILE"
    exit 1
}

# Calculate checksums
echo "Calculating checksums for verification..."
SOURCE_MD5=$(dd if="$SOURCE_DEVICE" bs=4M count="$(($DEVICE_SIZE / (4*1024*1024)))" | md5sum | cut -d' ' -f1)
BACKUP_MD5=$(md5sum "$BACKUP_FILE" | cut -d' ' -f1)

if [ "$SOURCE_MD5" = "$BACKUP_MD5" ]; then
    echo "Backup completed successfully!"
    echo "Backup location: $BACKUP_FILE"
    echo "MD5 checksum: $SOURCE_MD5"
else
    echo "Error: Backup verification failed!"
    echo "Source MD5: $SOURCE_MD5"
    echo "Backup MD5: $BACKUP_MD5"
    rm -f "$BACKUP_FILE"
    exit 1
fi
