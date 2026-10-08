import Avatar from "../../../assets/main-pages/Avatar.png";

const Testimonial = () => {
  return (
    <section className="bg-[#F9FAFB]">
      <div className="container py-[60px] text-center">
        <h2 className="text-[#112929] max-md:max-w-[234px] mx-auto text-4xl mb-10 md:mb-16 font-medium">
          Customer satisfaction, Our priority
        </h2>
        <article className="">
          <p className="text-[#101828] font-medium text-xl md:text-5xl mb-8">
            “Bill payment is so much easier since i started using Erhapay and i
            can&apos;t imagine my life without it.&apos;&apos;
          </p>
          <div className="flex flex-col items-center">
            <img src={Avatar} className="object-cover size-16" />
            <h4 className="text-[#101828] font-medium text-lg mt-4 mb-1">
              Folake Festus
            </h4>
            <p className="text-[#475467]">Retailer</p>
          </div>
        </article>
      </div>
    </section>
  );
};

export default Testimonial;
