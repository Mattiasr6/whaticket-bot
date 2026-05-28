import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";

interface ContactData {
  email?: string;
  number?: string;
  name?: string;
}

interface Request {
  contactData: ContactData;
  contactId: string;
}

const UpdateContactService = async ({
  contactData,
  contactId
}: Request): Promise<Contact> => {
  const { email, name, number } = contactData;

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: ["id", "name", "number", "email", "profilePicUrl"]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  await contact.update({
    name,
    number,
    email
  });

  await contact.reload({
    attributes: ["id", "name", "number", "email", "profilePicUrl"]
  });

  return contact;
};

export default UpdateContactService;
