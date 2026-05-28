import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";

interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
}

const CreateContactService = async ({
  name,
  number,
  email = ""
}: Request): Promise<Contact> => {
  const numberExists = await Contact.findOne({
    where: { number }
  });

  if (numberExists) {
    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  const contact = await Contact.create({
    name,
    number,
    email
  });

  return contact;
};

export default CreateContactService;
