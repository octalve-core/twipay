import { partnerships } from "@/lib/constants"

const Partnerships = () => {
  return (
    <div className="p-[53px] md:p-[60px] text-center md:bg-white">
      <div className="container">
          <h2 className="text-[#112929] md:text-xl md:mb-8 font-medium mb-10">In Partnership with the world&apos;s largest companies</h2>
          <div className="flex flex-col md:flex-row items-center justify-between max-md:gap-8">
              {
                  partnerships.map(({id, image, width}) => (
                      <img style={{ width: `${width}px`}} className="h-12" key={id} src={image} />
                  ))
              }
          </div>
        </div>
    </div>
  )
}

export default Partnerships