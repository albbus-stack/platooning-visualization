import { NextPage } from "next";
import AboutPage from "../../components/pages/about";
import { setLanguageTag } from "../../src/paraglide/runtime";

const About: NextPage = () => {
  setLanguageTag("fr");

  return <AboutPage />;
};

export default About;