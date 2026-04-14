export const initialData = {
  name: '',
  position: '',
  contact: {
    phone: '',
    email: '',
    website: '',
    websiteIcon: 'fas fa-globe',
    linkedin: '',
    github: '',
    location: ''
  },
  summary: '',
  coreCompetencies: [
    {
      id: 1,
      name: ''
    }
  ],
  languages: [
    {
      id: 1,
      name: '',
      level: null,
      proficiency: ''
    }
  ],
  skills: [
    {
      id: 1,
      name: ''
    }
  ],
  achievements: [
    {
      id: 1,
      title: '',
      description: ''
    }
  ],
  experience: [
    {
      id: 1,
      title: '',
      company: '',
      period: '',
      location: '',
      description: '',
      achievements: []
    }
  ],
  education: [
    {
      id: 1,
      type: 'degree',
      degree: '',
      school: '',
      period: '',
      location: ''
    }
  ],
  customSections: [],
};

// Predefined custom section templates
export const customSectionTemplates = {
  projects: {
    name: 'Projects',
    type: 'projects',
    position: 'main',
    items: [{ id: 1, title: '', description: '', technologies: '', link: '' }],
  },
  certifications: {
    name: 'Certifications',
    type: 'certifications',
    position: 'sidebar',
    items: [{ id: 1, name: '', issuer: '', credentialId: '', expiryDate: '' }],
  },
  publications: {
    name: 'Publications',
    type: 'publications',
    position: 'main',
    items: [{ id: 1, title: '', journal: '', date: '', doi: '' }],
  },
  volunteer: {
    name: 'Volunteer Work',
    type: 'volunteer',
    position: 'main',
    items: [{ id: 1, role: '', organization: '', period: '', description: '' }],
  },
  references: {
    name: 'References',
    type: 'references',
    position: 'sidebar',
    items: [{ id: 1, name: '', title: '', company: '', contact: '' }],
  },
  custom: {
    name: 'Custom Section',
    type: 'custom',
    position: 'sidebar',
    items: [{ id: 1, title: '', description: '' }],
  },
};

export const initialCoverLetterData = {
  // Sender
  name: '',
  street: '',
  city: '',
  phone: '',
  email: '',

  // Place and Date
  place: '',
  date: '',

  // Recipient
  recipientCompany: '',
  recipientContact: '',
  recipientStreet: '',
  recipientCity: '',

  // Brief
  subject: '',
  salutation: '',
  body: '',
  closing: '',
  signature: '',
  signatureImage: null,
  extraPages: [],
};
