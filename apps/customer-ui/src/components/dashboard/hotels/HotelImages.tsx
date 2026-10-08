import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import Hotel_Img_1 from "@/assets/dashboard/hotel_image_1.png"
import Hotel_Img_2 from "@/assets/dashboard/hotel_image_2.png"
import Hotel_Img_3 from "@/assets/dashboard/hotel_image_3.png"

const hotelImages = [Hotel_Img_1, Hotel_Img_2, Hotel_Img_3, Hotel_Img_2, Hotel_Img_1, Hotel_Img_3]

const HotelImages = () => {
  return (
    <div className="mb-5 h-[185px] w-full max-md:-order-1">
      <Carousel
        opts={{
          align: "start",
        }}
        className="w-full h-full"
      >
        <CarouselContent className="h-full">
          {hotelImages.map((image, index) => (
            <CarouselItem key={index} className="">
              <div className="h-full">
                <img className="object-cover w-full max-h-[185px] rounded-lg" src={image} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="bg-white" />
        <CarouselNext className="bg-white" />
      </Carousel>
    </div>
  )
}

export default HotelImages