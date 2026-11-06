import { getBanners, TBanner } from "@/lib/api/dashboard-apis/banners";
import { useQuery } from "@tanstack/react-query";

const Campaign = () => {
    const { data: banners, isLoading } = useQuery<TBanner[], Error>({
        queryKey: ["banners"],
        queryFn: getBanners,
    });

  return (
    <section className="mt-10 md:mt-5">
        <h2 className="text-[#667085] md:text-[#101928] max-md:text-sm mb-4 font-medium">Campaign</h2>
        {
            banners?.length && !isLoading && (
                <div className="overflow-x-auto mb-6 hide-scrollbar">
                    <div className="flex gap-2 md:gap-4 w-full">
                        {banners.map((banner) => (
                            <div
                                key={banner._id}
                                className="w-[90%] shrink-0 rounded-xl md:h-[320px] h-[202px] overflow-hidden border border-[#EAECF0]"
                            >
                                <img 
                                    src={banner.previewImageUrl} 
                                    alt="Banner" 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )
        }
        {/* <Link 
            to="/dashboard/services"
            style={{
                backgroundImage: `url(${BgImage})`,
                backgroundRepeat:"no-repeat",
                backgroundSize: "cover",
                backgroundPosition: "top"
            }}
            className="relative inline-block w-full rounded-xl md:h-[280px] h-[152px] after:inset-0 after:absolute after:bg-black/70 hover:after:bg-black/75 transition after:rounded-xl group"
        >
            <div className="absolute text-white z-10 bottom-5 md:bottom-10 left-5 md:left-10">
                <p className="text-xs md:text-2xl">Tap to participate</p>
                <div className="flex items-start">
                    <p className="text-3xl md:text-6xl font-bold [line-height:.8]">Referral<img alt="" className="inline size-3.5 md:size-7 ml-2 md:ml-4 group-hover:translate-x-2 transition" src={DoubleArrow} /> <br />Campaign</p>
                </div>
            </div>
        </Link> */}
    </section>
  )
}

export default Campaign