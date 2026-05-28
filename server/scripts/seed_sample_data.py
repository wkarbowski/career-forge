#!/usr/bin/env python3
"""Seed the database with sample data for testing and screenshots.

Creates:
- 1 demo user account
- 3 resumes with different templates
- 2 cover letters
- Document versions
- Linked documents (resume + cover letter pairs)

Usage:
    python scripts/seed_sample_data.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.auth import get_password_hash
from app.database import SessionLocal
from app.models import Document, DocumentVersion, User


def create_sample_user(db: Session) -> User:
    """Create a demo user account."""
    # Check if user already exists
    existing = db.query(User).filter(User.email == "demo@example.com").first()
    if existing:
        print(f"✓ Demo user already exists: {existing.email}")
        return existing

    user = User(
        email="demo@example.com",
        username="demo_user",
        hashed_password=get_password_hash("DemoPass123!"),
        is_active=True,
        theme="dark",
        language="en",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"✓ Created demo user: {user.email}")
    print("  Password: DemoPass123!")
    return user


def create_professional_resume(db: Session, user: User) -> Document:
    """Create a professional resume with complete data."""
    data = {
        "template": "professional",
        "name": "Jane Smith",
        "position": "Senior Full-Stack Developer",
        "email": "jane.smith@example.com",
        "phone": "+1 (555) 123-4567",
        "location": "San Francisco, CA",
        "linkedin": "linkedin.com/in/janesmith",
        "github": "github.com/janesmith",
        "website": "janesmith.dev",
        "summary": "Results-driven Full-Stack Developer with 8+ years of experience building scalable web applications. Expert in React, Python, and cloud infrastructure. Passionate about clean code, automated testing, and mentoring junior developers.",
        "experience": [
            {
                "company": "TechCorp Inc.",
                "position": "Senior Software Engineer",
                "location": "San Francisco, CA",
                "startDate": "2020-03",
                "endDate": "present",
                "current": True,
                "description": "<ul><li>Led development of microservices architecture serving 2M+ users</li><li>Reduced API response time by 60% through query optimization</li><li>Mentored 5 junior developers and conducted code reviews</li><li>Implemented CI/CD pipeline reducing deployment time by 75%</li></ul>",
            },
            {
                "company": "StartupXYZ",
                "position": "Full-Stack Developer",
                "location": "Remote",
                "startDate": "2018-01",
                "endDate": "2020-02",
                "current": False,
                "description": "<ul><li>Built customer-facing SaaS platform from scratch (React + Django)</li><li>Integrated payment processing and email automation</li><li>Achieved 99.9% uptime through monitoring and alerting</li></ul>",
            },
            {
                "company": "Digital Agency Co.",
                "position": "Junior Developer",
                "location": "New York, NY",
                "startDate": "2016-06",
                "endDate": "2017-12",
                "current": False,
                "description": "<ul><li>Developed responsive websites for 20+ clients</li><li>Collaborated with designers to implement pixel-perfect UIs</li><li>Maintained WordPress and custom PHP applications</li></ul>",
            },
        ],
        "education": [
            {
                "institution": "University of California, Berkeley",
                "degree": "B.S. in Computer Science",
                "location": "Berkeley, CA",
                "startDate": "2012-09",
                "endDate": "2016-05",
                "description": "GPA: 3.8/4.0. Dean's List. Focus on Software Engineering and Algorithms.",
            }
        ],
        "skills": [
            {
                "category": "Frontend",
                "items": ["React", "TypeScript", "Next.js", "Tailwind CSS", "Vue.js"],
            },
            {
                "category": "Backend",
                "items": ["Python", "FastAPI", "Django", "Node.js", "PostgreSQL"],
            },
            {
                "category": "DevOps",
                "items": ["Docker", "Kubernetes", "AWS", "CI/CD", "Terraform"],
            },
            {
                "category": "Tools",
                "items": ["Git", "VS Code", "Jira", "Figma", "Postman"],
            },
        ],
        "languages": [
            {"name": "English", "level": "Native"},
            {"name": "Spanish", "level": "Professional"},
        ],
        "accentColor": "#2563eb",
        "fontFamily": "Inter",
    }

    doc = Document(
        title="Senior Developer Resume - Jane Smith",
        document_type="resume",
        data=data,
        owner_id=user.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    print(f"✓ Created professional resume: {doc.title}")
    return doc


def create_modern_resume(db: Session, user: User) -> Document:
    """Create a modern resume for a designer."""
    data = {
        "template": "modern",
        "name": "Alex Chen",
        "position": "UI/UX Designer",
        "email": "alex.chen@designstudio.com",
        "phone": "+1 (555) 987-6543",
        "location": "Austin, TX",
        "portfolio": "alexchen.design",
        "linkedin": "linkedin.com/in/alexchen",
        "summary": "Creative UI/UX designer with 5 years of experience crafting intuitive digital experiences. Specialized in design systems, user research, and prototyping. Advocate for accessibility and inclusive design.",
        "experience": [
            {
                "company": "Design Studio Pro",
                "position": "Senior UI/UX Designer",
                "location": "Austin, TX",
                "startDate": "2021-06",
                "endDate": "present",
                "current": True,
                "description": "<ul><li>Designed and launched 15+ web and mobile applications</li><li>Created comprehensive design system used across 8 products</li><li>Conducted user research with 200+ participants</li><li>Improved conversion rates by 40% through UX optimization</li></ul>",
            },
            {
                "company": "Creative Agency",
                "position": "UX Designer",
                "location": "Remote",
                "startDate": "2019-03",
                "endDate": "2021-05",
                "current": False,
                "description": "<ul><li>Designed responsive interfaces for e-commerce clients</li><li>Collaborated with developers using Figma and Zeplin</li><li>Led usability testing sessions and A/B experiments</li></ul>",
            },
        ],
        "education": [
            {
                "institution": "Rhode Island School of Design",
                "degree": "BFA in Graphic Design",
                "location": "Providence, RI",
                "startDate": "2015-09",
                "endDate": "2019-05",
                "description": "Focus on Digital Media and Interactive Design.",
            }
        ],
        "skills": [
            {
                "category": "Design Tools",
                "items": ["Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator"],
            },
            {
                "category": "Prototyping",
                "items": ["Framer", "Principle", "ProtoPie", "InVision"],
            },
            {
                "category": "Front-End",
                "items": ["HTML", "CSS", "JavaScript", "React (basic)"],
            },
        ],
        "accentColor": "#8b5cf6",
        "fontFamily": "Poppins",
    }

    doc = Document(
        title="UX Designer Resume - Alex Chen",
        document_type="resume",
        data=data,
        owner_id=user.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    print(f"✓ Created modern resume: {doc.title}")
    return doc


def create_minimal_resume(db: Session, user: User) -> Document:
    """Create a minimal resume for a data scientist."""
    data = {
        "template": "minimal",
        "name": "Dr. Sarah Johnson",
        "position": "Data Scientist",
        "email": "sarah.johnson@research.edu",
        "phone": "+1 (555) 234-5678",
        "location": "Boston, MA",
        "summary": "Ph.D. in Machine Learning with expertise in NLP and computer vision. Published researcher with 12 papers in top-tier conferences. Passionate about applying AI to solve real-world problems.",
        "experience": [
            {
                "company": "AI Research Lab",
                "position": "Senior Data Scientist",
                "location": "Boston, MA",
                "startDate": "2022-01",
                "endDate": "present",
                "current": True,
                "description": "<ul><li>Developed NLP models improving accuracy by 25%</li><li>Published 4 papers at NeurIPS and ICML</li><li>Mentored 3 PhD students on research projects</li></ul>",
            },
            {
                "company": "Tech Innovations Inc.",
                "position": "Machine Learning Engineer",
                "location": "San Francisco, CA",
                "startDate": "2020-06",
                "endDate": "2021-12",
                "current": False,
                "description": "<ul><li>Built recommendation system serving 5M users</li><li>Deployed models to production using MLOps best practices</li><li>Reduced model inference time by 70%</li></ul>",
            },
        ],
        "education": [
            {
                "institution": "MIT",
                "degree": "Ph.D. in Computer Science (Machine Learning)",
                "location": "Cambridge, MA",
                "startDate": "2016-09",
                "endDate": "2020-05",
                "description": "Dissertation: 'Neural Architectures for Natural Language Understanding'",
            },
            {
                "institution": "Stanford University",
                "degree": "M.S. in Computer Science",
                "location": "Stanford, CA",
                "startDate": "2014-09",
                "endDate": "2016-06",
                "description": "",
            },
        ],
        "skills": [
            {
                "category": "ML/AI",
                "items": ["PyTorch", "TensorFlow", "Transformers", "scikit-learn"],
            },
            {
                "category": "Languages",
                "items": ["Python", "R", "SQL", "C++"],
            },
            {
                "category": "Tools",
                "items": ["Jupyter", "MLflow", "Docker", "AWS SageMaker"],
            },
        ],
        "accentColor": "#059669",
        "fontFamily": "Roboto",
    }

    doc = Document(
        title="Data Scientist Resume - Dr. Johnson",
        document_type="resume",
        data=data,
        owner_id=user.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    print(f"✓ Created minimal resume: {doc.title}")
    return doc


def create_cover_letter_1(db: Session, user: User, linked_resume: Document | None = None) -> Document:
    """Create a cover letter for a tech company application."""
    data = {
        "documentType": "cover-letter",
        "settings": {
            "accentColor": "#7c6f57",
            "clStyle": "executive",
            "sidebarColor1": "#111827",
            "sidebarColor2": "#374151",
        },
        "clSettings": {
            "nameFont": "Playfair Display",
            "nameFontSize": 28,
            "senderFont": "Inter",
            "senderFontSize": 11,
            "subjectFont": "Playfair Display",
            "subjectFontSize": 14,
            "bodyFont": "Inter",
            "bodyFontSize": 12,
        },
        "coverLetterData": {
            "name": "Jane Smith",
            "street": "123 Tech Street",
            "city": "San Francisco, CA 94102",
            "email": "jane.smith@example.com",
            "phone": "+1 (555) 123-4567",
            "place": "San Francisco",
            "date": "May 2, 2026",
            "recipientCompany": "TechVision Inc.",
            "recipientContact": "Mr. Robert Miller",
            "recipientStreet": "456 Innovation Blvd",
            "recipientCity": "San Francisco, CA 94103",
            "subject": "Application for Senior Full-Stack Developer Position",
            "salutation": "Dear Mr. Miller,",
            "body": "<p>I am writing to express my strong interest in the Senior Full-Stack Developer position at TechVision Inc. With over 8 years of experience building scalable web applications and a proven track record of leading high-impact projects, I am excited about the opportunity to contribute to your team.</p><p>In my current role at TechCorp Inc., I have led the development of microservices architecture serving over 2 million users, reducing API response time by 60% through strategic optimization. I am particularly drawn to TechVision&#39;s commitment to innovation and your recent work on AI-powered solutions, which aligns perfectly with my passion for cutting-edge technology.</p><p>My expertise in React, Python, and cloud infrastructure, combined with my experience mentoring junior developers, positions me well to make an immediate impact on your team. I am impressed by TechVision&#39;s collaborative culture and would welcome the opportunity to contribute to your mission of building transformative technology.</p><p>Thank you for considering my application. I look forward to the opportunity to discuss how my skills and experience can benefit TechVision Inc.</p>",
            "closing": "Sincerely,",
            "signature": "",
            "signatureImage": None,
            "extraPages": [],
        },
    }

    doc = Document(
        title="Cover Letter - TechVision Inc.",
        document_type="cover_letter",
        data=data,
        owner_id=user.id,
        linked_resume_id=linked_resume.id if linked_resume else None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    print(f"✓ Created cover letter: {doc.title}")
    return doc


def create_cover_letter_2(db: Session, user: User, linked_resume: Document | None = None) -> Document:
    """Create a cover letter for a startup application."""
    data = {
        "documentType": "cover-letter",
        "settings": {
            "accentColor": "#2563eb",
            "clStyle": "standard",
        },
        "clSettings": {
            "nameFont": "Open Sans",
            "nameFontSize": 28,
            "senderFont": "Open Sans",
            "senderFontSize": 11,
            "subjectFont": "Open Sans",
            "subjectFontSize": 13,
            "bodyFont": "Open Sans",
            "bodyFontSize": 12,
        },
        "coverLetterData": {
            "name": "Alex Chen",
            "street": "789 Design Ave",
            "city": "Austin, TX 78701",
            "email": "alex.chen@designstudio.com",
            "phone": "+1 (555) 987-6543",
            "place": "Austin",
            "date": "May 2, 2026",
            "recipientCompany": "CreativeFlow Startup",
            "recipientContact": "Ms. Emily Rodriguez",
            "recipientStreet": "321 Startup Way",
            "recipientCity": "Austin, TX 78702",
            "subject": "Application for Lead UX Designer Position",
            "salutation": "Dear Ms. Rodriguez,",
            "body": "<p>I am thrilled to apply for the Lead UX Designer position at CreativeFlow Startup. Your company&#39;s mission to democratize design tools resonates deeply with my commitment to creating accessible, user-centered experiences.</p><p>Over the past 5 years, I have designed and launched over 15 web and mobile applications, created comprehensive design systems, and conducted extensive user research. At Design Studio Pro, I improved conversion rates by 40% through data-driven UX optimization and established design practices that scaled across 8 products.</p><p>What excites me most about CreativeFlow is your focus on empowering non-designers to create professional work. I believe my background in design systems, prototyping, and user research would be valuable in advancing this vision. I am particularly impressed by your recent product launch and would love to contribute to your next phase of growth.</p><p>I would welcome the opportunity to discuss how my skills in Figma, user research, and cross-functional collaboration can help CreativeFlow achieve its ambitious goals.</p>",
            "closing": "Best regards,",
            "signature": "",
            "signatureImage": None,
            "extraPages": [],
        },
    }

    doc = Document(
        title="Cover Letter - CreativeFlow Startup",
        document_type="cover_letter",
        data=data,
        owner_id=user.id,
        linked_resume_id=linked_resume.id if linked_resume else None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    print(f"✓ Created cover letter: {doc.title}")
    return doc


def create_document_versions(db: Session, document: Document) -> None:
    """Create a few version snapshots for a document."""
    versions = [
        {
            "version_name": "Initial Draft",
        },
        {
            "version_name": "After Review",
        },
        {
            "version_name": "Final Version",
        },
    ]

    for _, version_data in enumerate(versions):
        version = DocumentVersion(
            document_id=document.id,
            version_name=version_data["version_name"],
            data=document.data,  # Use current document data for simplicity
            created_at=datetime.now(UTC),
        )
        db.add(version)

    db.commit()
    print(f"✓ Created {len(versions)} version snapshots for: {document.title}")


def main() -> None:
    """Main function to seed sample data."""
    print("\n🌱 Seeding Career Forge with sample data...\n")

    db = SessionLocal()
    try:
        # Create demo user
        user = create_sample_user(db)

        # Create resumes
        resume1 = create_professional_resume(db, user)
        resume2 = create_modern_resume(db, user)
        create_minimal_resume(db, user)

        # Create cover letters (linked to resumes)
        create_cover_letter_1(db, user, linked_resume=resume1)
        create_cover_letter_2(db, user, linked_resume=resume2)

        # Create version history for the first resume
        create_document_versions(db, resume1)

        print("\n✅ Sample data created successfully!")
        print("\n📋 Summary:")
        print("   • User: demo@example.com (Password: DemoPass123!)")
        print("   • Resumes: 3 (Professional, Modern, Minimal)")
        print("   • Cover Letters: 2 (linked to resumes)")
        print("   • Document Versions: 3 snapshots for first resume")
        print("\n🌐 You can now log in at: http://localhost")
        print("   Email: demo@example.com")
        print("   Password: DemoPass123!")
        print()

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
