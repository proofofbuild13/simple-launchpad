import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      profile: {
        title: "Profile",
        description: "Manage your public profile, work history and payment details.",
        viewPublicProfile: "View Public Profile",
        tabs: {
          personal: "Personal Details",
          experience: "Experience",
          education: "Education",
          skills: "Skills & Portfolio",
          payments: "Payment methods"
        },
        personal: {
          title: "Personal information",
          fields: {
            fullName: "Full name",
            domain: "Domain",
            domainPlaceholder: "Select primary domain",
            titleLabel: "Title",
            titlePlaceholder: "Senior Full-stack Engineer",
            location: "Location",
            phone: "Phone",
            avatarUrl: "Avatar URL",
            bannerUrl: "Banner image URL",
            bio: "Bio",
            availableForWork: "Available for work",
            availableDescription: "Show the \"Available\" badge on your profile.",
            companyName: "Company name",
            founderName: "Founder name",
            industry: "Industry",
            stage: "Stage",
            stagePlaceholder: "idea / seed / series-a",
            teamSize: "Team size",
            teamSizePlaceholder: "1-10",
            website: "Website",
            mission: "Mission",
            about: "About",
            logoUrl: "Logo URL",
            activelyHiring: "Actively hiring",
            hiringDescription: "Display the \"Hiring\" badge in the Marketplace."
          },
          saving: "Saving...",
          save: "Save",
          updated: "Profile updated"
        },
        domains: {
          "Frontend Development": "Frontend Development",
          "Backend Development": "Backend Development",
          "Full-stack Development": "Full-stack Development",
          "Mobile Development": "Mobile Development",
          "AI / Machine Learning": "AI / Machine Learning",
          "Data Science & Engineering": "Data Science & Engineering",
          "DevOps & Cloud": "DevOps & Cloud",
          "UI/UX Design": "UI/UX Design",
          "Blockchain / Web3": "Blockchain / Web3",
          "Other": "Other"
        },
        experience: {
          title: "Work experience",
          add: "Add",
          noExperience: "No experience added yet.",
          present: "Present",
          edit: "Edit",
          delete: "Delete",
          fields: {
            company: "Company",
            role: "Role",
            type: "Type",
            typePlaceholder: "Select",
            start: "Start",
            end: "End",
            currentWork: "I currently work here",
            description: "Description",
            achievements: "Achievements"
          },
          employmentTypes: {
            "Full-time": "Full-time",
            "Part-time": "Part-time",
            "Contract": "Contract",
            "Freelance": "Freelance",
            "Internship": "Internship",
            "Founder": "Founder"
          },
          requiredError: "Company and role are required",
          save: "Save",
          cancel: "Cancel",
          saved: "Saved"
        },
        education: {
          title: "Education",
          add: "Add",
          noEducation: "No education added yet.",
          present: "Present",
          edit: "Edit",
          delete: "Delete",
          fields: {
            institution: "Institution",
            degree: "Degree",
            specialization: "Specialization",
            startYear: "Start year",
            endYear: "End year",
            grade: "Grade / GPA",
            achievements: "Achievements"
          },
          requiredError: "Institution is required",
          save: "Save",
          cancel: "Cancel",
          saved: "Saved"
        },
        skills: {
          title: "Skills & portfolio",
          fields: {
            skillsLabel: "Skills (comma separated)",
            expLevel: "Experience level",
            expLevelPlaceholder: "Select",
            hourlyRate: "Hourly rate (USD)",
            workPreference: "Work preference",
            workPrefPlaceholder: "remote / hybrid / onsite",
            portfolio: "Portfolio URL",
            github: "GitHub",
            linkedin: "LinkedIn"
          },
          experienceLevels: {
            "junior": "junior",
            "mid": "mid",
            "senior": "senior",
            "expert": "expert"
          },
          saving: "Saving...",
          save: "Save",
          saved: "Saved"
        },
        payments: {
          title: "Payment methods",
          subTitle: "Founders on your active contracts will see your default method (masked).",
          add: "Add",
          noMethods: "No payment methods yet.",
          default: "Default",
          verified: "Verified",
          upiPrefix: "UPI: ",
          makeDefault: "Make default",
          edit: "Edit",
          delete: "Delete",
          fields: {
            methodType: "Method type",
            upiId: "UPI ID",
            upiIdPlaceholder: "name@bank",
            accountHolder: "Account holder",
            bankName: "Bank name",
            accountNumber: "Account number",
            ifsc: "IFSC",
            setDefault: "Set as default"
          },
          methodTypes: {
            "upi": "UPI",
            "bank": "Bank account"
          },
          save: "Save",
          cancel: "Cancel",
          typeError: "Pick a method type",
          saved: "Saved. Founders on your active contracts have been notified.",
          defaultUpdated: "Default updated"
        }
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
