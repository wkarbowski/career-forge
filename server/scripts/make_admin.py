#!/usr/bin/env python3
"""
Career Forge — Admin Management Script

Grants or revokes admin privileges for a user account identified by email.

Usage:
    python scripts/make_admin.py <email>           # Grant admin privileges
    python scripts/make_admin.py --revoke <email>  # Revoke admin privileges
    python scripts/make_admin.py --list            # List all admin users

Run from the server/ directory with the virtual environment activated.
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User


def make_admin(email: str) -> bool:
    """Grant admin privileges to a user."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.lower()).first()
        
        if not user:
            print(f"❌ User not found: {email}")
            return False
        
        if user.is_admin:
            print(f"ℹ️  User {email} is already an admin")
            return True
        
        user.is_admin = True
        db.commit()
        print(f"✅ Admin privileges granted to: {email}")
        return True
        
    finally:
        db.close()


def revoke_admin(email: str) -> bool:
    """Revoke admin privileges from a user."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.lower()).first()
        
        if not user:
            print(f"❌ User not found: {email}")
            return False
        
        if not user.is_admin:
            print(f"ℹ️  User {email} is not an admin")
            return True
        
        user.is_admin = False
        db.commit()
        print(f"✅ Admin privileges revoked from: {email}")
        return True
        
    finally:
        db.close()


def list_admins() -> None:
    """List all admin users."""
    db = SessionLocal()
    try:
        admins = db.query(User).filter(User.is_admin == True).all()
        
        if not admins:
            print("No admin users found.")
            return
        
        print("Admin users:")
        for admin in admins:
            print(f"  - {admin.email} (ID: {admin.id})")
            
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Career Forge — Admin Management Script")
        print("")
        print("Usage:")
        print("  python scripts/make_admin.py <email>           # Grant admin privileges")
        print("  python scripts/make_admin.py --revoke <email>  # Revoke admin privileges")
        print("  python scripts/make_admin.py --list            # List all admin users")
        sys.exit(1)
    
    if sys.argv[1] == "--list":
        list_admins()
    elif sys.argv[1] == "--revoke" and len(sys.argv) >= 3:
        revoke_admin(sys.argv[2])
    else:
        make_admin(sys.argv[1])
