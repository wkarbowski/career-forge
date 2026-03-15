export const initialData = {
  name: '',
  position: '',
  contact: {
    phone: '',
    email: '',
    website: '',
    websiteIcon: 'fas fa-globe',
    location: ''
  },
  summary: '',
  strengths: [
    {
      id: 1,
      title: '',
      description: ''
    }
  ],
  languages: [
    {
      id: 1,
      name: '',
      level: 4,
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
      degree: '',
      school: '',
      period: '',
      location: ''
    }
  ],
  courses: [
    {
      id: 1,
      title: '',
      description: ''
    }
  ]
};

export const initialCoverLetterData = {
  // Absender
  name: '',
  street: '',
  city: '',
  phone: '',
  email: '',

  // Ort und Datum
  place: '',
  date: '',

  // Empfänger
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
};
