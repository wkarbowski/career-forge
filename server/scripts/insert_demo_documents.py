#!/usr/bin/env python3
"""Insert one fully-filled resume and one cover letter for the demo user."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.database import SessionLocal
from app.models import Document, User

RESUME_DATA = {
    "documentType": "resume",
    "profileImage": None,
    "settings": {
        "layout": "top-header",
        "nameFont": "Playfair Display",
        "subtitleFont": "Inter",
        "headingFont": "Inter",
        "bodyFont": "Inter",
        "titleFont": "Playfair Display",
        "nameFontSize": 36,
        "subtitleFontSize": 14,
        "headingFontSize": 13,
        "bodyFontSize": 12,
        "accentColor": "#7c6f57",
        "sidebarColor1": "#111827",
        "sidebarColor2": "#374151",
    },
    "clSettings": {
        "nameFont": "Playfair Display",
        "senderFont": "Inter",
        "subjectFont": "Playfair Display",
        "bodyFont": "Inter",
        "nameFontSize": 28,
        "senderFontSize": 11,
        "subjectFontSize": 14,
        "bodyFontSize": 12,
    },
    "sidebarOrder": ["skills", "coreCompetencies", "languages", "summary", "achievements"],
    "visibleSections": {
        "experience": True,
        "education": True,
        "skills": True,
        "languages": True,
        "summary": True,
        "achievements": True,
        "coreCompetencies": True,
    },
    "pages": [{"id": "page-demo-1", "pageNumber": 1, "sections": {"main": None, "sidebar": None}}],
    "data": {
        "name": "Alex Novak",
        "position": "Senior Software Engineer",
        "contact": {
            "email": "alex.novak@example.com",
            "phone": "+1 555 010 0200",
            "location": "Sample City, Country",
            "links": [
                {"id": 1, "icon": "fab fa-linkedin", "url": "https://linkedin.com/in/alex-novak-demo"},
                {"id": 2, "icon": "fab fa-github", "url": "https://github.com/alex-novak-demo"},
                {"id": 3, "icon": "fas fa-globe", "url": "https://alex-novak.example.com"},
            ],
        },
        "summary": "Full-stack engineer with 9 years in fintech and SaaS. Focused on clean architecture, TDD, and technical leadership across the full deployment lifecycle.",
        "experience": [
            {
                "id": 1,
                "title": "Senior Software Engineer",
                "company": "Nexora Financial",
                "location": "Sample City, Country",
                "period": "Mar 2021 – Present",
                "description": "<ul><li>Architected a real-time payment service handling $2M+ daily transactions</li><li>Reduced API latency 55 % via query optimisation and Redis caching</li><li>Led monolith-to-microservices migration with zero downtime</li></ul>",
                "achievements": [],
            },
            {
                "id": 2,
                "title": "Full-Stack Developer",
                "company": "Stratos Digital",
                "location": "Riverside, Country",
                "period": "Jan 2019 – Feb 2021",
                "description": "<ul><li>Built a multi-tenant SaaS analytics dashboard (React + FastAPI)</li><li>Implemented OAuth 2.0 SSO for enterprise clients; 98 % test coverage</li></ul>",
                "achievements": [],
            },
            {
                "id": 3,
                "title": "Junior Developer",
                "company": "Pixel Works",
                "location": "Lakewood, Country",
                "period": "Jul 2017 – Dec 2018",
                "description": "<ul><li>Built responsive sites with WordPress and PHP; integrated payment and maps APIs</li><li>Cut average page load time 40 % via image optimisation and CDN</li></ul>",
                "achievements": [],
            },
        ],
        "education": [
            {
                "id": 1,
                "type": "degree",
                "school": "Meridian Technical University",
                "degree": "M.Sc. Computer Science",
                "location": "Sample City, Country",
                "period": "Oct 2015 – Jun 2017",
                "description": "Distributed Systems specialisation. Thesis: Consistency Models in Geo-Replicated Databases.",
            },
            {
                "id": 2,
                "type": "degree",
                "school": "Lakeview University",
                "degree": "B.Sc. Computer Science",
                "location": "Lakewood, Country",
                "period": "Oct 2012 – Sep 2015",
                "description": "Minor in Mathematics. Final grade: 1.4 (with distinction).",
            },
        ],
        "skills": [
            {"id": 1, "name": "TypeScript / JavaScript"},
            {"id": 2, "name": "React & Next.js"},
            {"id": 3, "name": "Python / FastAPI"},
            {"id": 4, "name": "PostgreSQL & Redis"},
            {"id": 5, "name": "Docker & Kubernetes"},
            {"id": 6, "name": "AWS (EC2, RDS, S3, Lambda)"},
            {"id": 7, "name": "CI/CD — GitHub Actions"},
            {"id": 8, "name": "Test-Driven Development"},
        ],
        "coreCompetencies": [
            {"id": 1, "name": "System Architecture"},
            {"id": 2, "name": "Technical Leadership"},
            {"id": 3, "name": "API Design (REST / GraphQL)"},
            {"id": 4, "name": "Performance Optimisation"},
        ],
        "languages": [
            {"id": 1, "name": "German", "level": "native", "proficiency": "Native"},
            {"id": 2, "name": "English", "level": "c2", "proficiency": "Fluent (C2)"},
            {"id": 3, "name": "French", "level": "b1", "proficiency": "Intermediate (B1)"},
        ],
        "achievements": [
            {
                "id": 1,
                "title": "Speaker — TechConf Europe 2023",
                "description": "Talk: Async Patterns in FastAPI at Scale (400+ attendees).",
            },
            {
                "id": 2,
                "title": "Open Source Contributor",
                "description": "12 merged PRs across open-source backend libraries.",
            },
        ],
        "customSections": [],
    },
    "coverLetterData": {
        "name": "",
        "street": "",
        "city": "",
        "email": "",
        "phone": "",
        "place": "",
        "date": "",
        "recipientCompany": "",
        "recipientContact": "",
        "recipientStreet": "",
        "recipientCity": "",
        "subject": "",
        "salutation": "",
        "body": "",
        "closing": "",
        "signature": "",
        "signatureImage": None,
        "extraPages": [],
    },
}

COVER_LETTER_DATA = {
    "documentType": "cover-letter",
    "profileImage": None,
    "settings": {
        "accentColor": "#7c6f57",
        "clStyle": "cover-executive",
        "sidebarColor1": "#111827",
        "sidebarColor2": "#374151",
        "layout": "top-header",
        "nameFont": "Playfair Display",
        "subtitleFont": "Inter",
        "headingFont": "Inter",
        "bodyFont": "Inter",
        "titleFont": "Playfair Display",
        "nameFontSize": 36,
        "subtitleFontSize": 14,
        "headingFontSize": 13,
        "bodyFontSize": 12,
    },
    "clSettings": {
        "nameFont": "Playfair Display",
        "senderFont": "Inter",
        "subjectFont": "Playfair Display",
        "bodyFont": "Inter",
        "nameFontSize": 28,
        "senderFontSize": 11,
        "subjectFontSize": 14,
        "bodyFontSize": 12,
    },
    "sidebarOrder": ["skills", "coreCompetencies", "languages", "summary", "achievements"],
    "visibleSections": {
        "experience": True,
        "education": True,
        "skills": True,
        "languages": True,
        "summary": True,
        "achievements": True,
        "coreCompetencies": True,
    },
    "pages": [{"id": "page-demo-cl-1", "pageNumber": 1, "sections": {"main": None, "sidebar": None}}],
    "data": {
        "name": "Alex Novak",
        "position": "Senior Software Engineer",
        "contact": {
            "email": "alex.novak@example.com",
            "phone": "+1 555 010 0200",
            "location": "Sample City, Country",
            "links": [
                {"id": 1, "icon": "fab fa-linkedin", "url": "https://linkedin.com/in/alex-novak-demo"},
                {"id": 2, "icon": "fab fa-github", "url": "https://github.com/alex-novak-demo"},
            ],
        },
        "summary": "",
        "experience": [],
        "education": [],
        "skills": [],
        "coreCompetencies": [],
        "languages": [],
        "achievements": [],
        "customSections": [],
    },
    "coverLetterData": {
        "name": "Alex Novak",
        "street": "100 Demo Street",
        "city": "10001 Sample City",
        "email": "alex.novak@example.com",
        "phone": "+1 555 010 0200",
        "place": "Sample City",
        "date": "9 May 2026",
        "recipientCompany": "Apex Financial Services",
        "recipientContact": "Ms. Sarah Miller",
        "recipientStreet": "200 Innovation Drive",
        "recipientCity": "10002 Sample City",
        "subject": "Application for Principal Engineer – Core Platform",
        "salutation": "Dear Ms. Miller,",
        "body": (
            "<p>I am writing to apply for the Principal Engineer position on the Core Platform team at Apex Financial Services, "
            "as advertised on your careers page. With over eight years of experience building high-throughput financial "
            "systems and leading cross-functional engineering teams, I am confident in my ability to contribute at the "
            "level this role demands.</p>"
            "<p>In my current position at Nexora Financial, I serve as the lead architect of a real-time payment processing "
            "service that handles in excess of two million dollars in daily transaction volume. My work has centred on "
            "distributed consistency guarantees, zero-downtime deployment strategies, and comprehensive observability "
            "pipelines — all within a PCI-DSS regulated environment. Prior to Nexora, I spent two years at Stratos Digital "
            "where I designed and delivered a multi-tenant SaaS platform serving enterprise clients across six markets, "
            "with a strong focus on API contract stability and long-term codebase maintainability.</p>"
            "<p>What draws me to Apex Financial Services is the combination of regulated infrastructure at scale and a "
            "reputation for genuine engineering ownership. I am particularly interested in the mentorship dimension of a "
            "principal role: I believe that raising the technical baseline across an entire team produces more durable "
            "value than any single individual contribution. I have led internal guild sessions on distributed systems "
            "patterns and enjoy the collaborative aspect of architectural decision-making.</p>"
            "<p>I would be very glad to discuss how my background aligns with the needs of your Core Platform team. "
            "I am available for a conversation at your convenience and can provide references on request. "
            "Thank you for your time and consideration.</p>"
        ),
        "closing": "Yours sincerely,",
        "signature": "Alex Novak",
        "signatureImage": (
            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAw"
            "MC9zdmciIHdpZHRoPSIyMjAiIGhlaWdodD0iNjAiPjx0ZXh0IHg9IjgiIHk9IjQ2IiBm"
            "b250LWZhbWlseT0iR2VvcmdpYSxzZXJpZiIgZm9udC1zaXplPSIzOCIgZm9udC1zdHls"
            "ZT0iaXRhbGljIiBmaWxsPSIjMWExYTJlIj5BbGV4IE5vdmFrPC90ZXh0Pjwvc3ZnPg=="
        ),
        "extraPages": [],
    },
}


DEMO_EMAIL = "demo@example.com"
DEMO_RESUME_TITLE = "Demo Resume – Alex Novak"
DEMO_COVER_LETTER_TITLE = "Demo Cover Letter – Apex Financial"


def main() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if not user:
            print(f"❌ Demo user '{DEMO_EMAIL}' not found. Run seed_sample_data.py first.")
            return

        # Delete any previous demo documents to keep things clean
        db.query(Document).filter(
            Document.owner_id == user.id,
            Document.title.in_([DEMO_RESUME_TITLE, DEMO_COVER_LETTER_TITLE]),
        ).delete(synchronize_session=False)
        db.commit()

        resume = Document(
            title=DEMO_RESUME_TITLE,
            document_type="resume",
            data=RESUME_DATA,
            owner_id=user.id,
            is_default=True,
        )
        db.add(resume)
        db.flush()

        cover = Document(
            title=DEMO_COVER_LETTER_TITLE,
            document_type="cover_letter",
            data=COVER_LETTER_DATA,
            owner_id=user.id,
            linked_resume_id=resume.id,
        )
        db.add(cover)
        db.commit()
        print(f"✓ Resume inserted  (id={resume.id})")
        print(f"✓ Cover letter inserted  (id={cover.id})")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
