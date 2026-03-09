import React from 'react';
import { ArrowRight } from 'lucide-react';

interface LandingPageProps {
    onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
    const [activeSlide, setActiveSlide] = React.useState(0);

    const slides = [
        {
            image: '/images/hd-slider-1.png',
            text: 'Next-generation cricket scoring with real-time match analytics and broadcast-standard visuals.'
        },
        {
            image: '/images/hd-slider-2.png',
            text: 'Advanced cricket scoring built for leagues, tournaments, and professional presentation.'
        },
        {
            image: '/images/hd-slider-3.png',
            text: 'Elevate every match. Experience Professional-Grade cricket scoring with real-time AI insights.'
        }
    ];

    React.useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % slides.length);
        }, 6000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen mesh-gradient text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden font-sans">

            {/* Background Slider - Responsive & HD */}
            <div className="absolute inset-0 z-0 text-white">
                {slides.map((slide, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-[1500ms] ease-in-out ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
                    >
                        <img
                            src={slide.image}
                            alt={`Cricket HD Slide ${index + 1}`}
                            className="w-full h-full object-cover object-center"
                            loading={index === 0 ? "eager" : "lazy"}
                        />
                    </div>
                ))}
                {/* Premium Overlay: Vignette + Gradient for perfect readability without global blur */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80"></div>
                <div className="absolute inset-0 bg-black/40"></div>
            </div>

            {/* Content Container - Fully Responsive */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

                <h1 className="text-5xl sm:text-7xl md:text-9xl font-black mb-4 sm:mb-8 tracking-tighter animate-fade-in-up drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] leading-tight text-center font-heading">
                    <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                        Pro Scorer
                    </span>
                </h1>

                <div className="relative h-24 sm:h-32 w-full flex items-center justify-center mb-10 sm:mb-16">
                    {slides.map((slide, index) => (
                        <p
                            key={index}
                            className={`absolute inset-0 text-slate-200 text-base sm:text-xl md:text-2xl leading-relaxed transition-all duration-1000 px-4 sm:px-10
                                ${index === activeSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                        >
                            {slide.text?.split('Professional-Grade').map((part, i, arr) => (
                                <React.Fragment key={i}>
                                    {part}
                                    {i < arr.length - 1 && <span className="text-amber-500 font-semibold italic">Professional-Grade</span>}
                                </React.Fragment>
                            ))}
                        </p>
                    ))}
                </div>

                <button
                    onClick={onGetStarted}
                    className="group relative w-full max-w-xs sm:max-w-md bg-brand-primary text-slate-950 font-black py-5 sm:py-6 rounded-[32px] transition-all duration-500 shadow-[0_20px_60px_rgba(0,255,156,0.2)] active:scale-95 hover:scale-[1.03] animate-fade-in-up delay-300 overflow-hidden mb-6"
                >
                    <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                    <span className="relative text-lg sm:text-xl tracking-[0.2em] flex items-center justify-center gap-3">
                        GET STARTED <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                    </span>
                </button>

                <div className="mt-16 sm:mt-24 text-center animate-fade-in delay-700">
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 tracking-widest uppercase">
                        Designed and Developed By <span className="text-white font-bold tracking-widest">PK</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
