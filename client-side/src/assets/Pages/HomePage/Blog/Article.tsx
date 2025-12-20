// Article.tsx
import React, { useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { useParams } from "react-router-dom";

type ArticleItem = {
    id: string;
    title: string;
    author: string;
    date: string;
    imageUrl?: string;
    content: string[];
};

const ARTICLES: ArticleItem[] = [
    {
        id: "1",
        title: "Optimizing volunteer management with technology.",
        author: "Volunteer Hub Team",
        date: "20/12/2025",
        imageUrl:
            "https://i.pinimg.com/1200x/dc/08/84/dc088443f1868f92e551950be6d1802c.jpg",
        content: [
            "In modern society, volunteering is becoming an increasingly important part of community development. Non-profit organizations, schools, hospitals, and many other social projects rely on volunteer contributions to fulfill their missions. However, managing a large number of volunteers often presents many challenges: from registration and task assignment to progress tracking and performance evaluation. In this context, technology is emerging as a powerful tool to optimize volunteer management, improve operational efficiency, and enhance the participant experience.",
            "In this context, modern technology has become a powerful tool for optimizing volunteer management, enhancing operational efficiency, and improving the participant experience. Volunteer management systems allow for the storage of complete personal information, skills, participation history, and task priorities for each volunteer. The technology platform can automatically assign tasks based on skills, location, and availability, and send reminders via email or text message, reducing administrative workload. Integrating notification channels, group chats, or forums also helps volunteers quickly update important information. These systems also provide detailed reports on working hours, contributions, and work quality assessments, supporting organizations in improving processes and recognizing volunteer achievements.",
            "Many organizations have successfully adopted online volunteer management applications such as VolunteerHub, SignUpGenius, or GivePulse, combined with CRM systems for non-profits and mobile applications to record direct working hours. Furthermore, data analytics and AI help predict needs, analyze behavior, and optimize volunteer resources. When applied correctly, technology not only reduces administrative workload but also increases volunteer retention through convenient and transparent experiences, improving operational efficiency and service quality, and creating a rich database for long-term planning and decision-making. In addition, technology helps to recognize and honor volunteer contributions fairly and transparently, fostering long-term engagement.",
            "In the digital age, optimizing volunteer management through technology has become essential for social organizations to operate effectively and sustainably. Investing in smart management platforms helps reduce workload, enhance connection and engagement among volunteers, thereby creating greater positive impacts on the community."
        ],
    },
    {
        id: "2",
        title: "Cân bằng công việc từ xa trong hoạt động thiện nguyện",
        author: "Community Insights",
        date: "18/12/2025",
        imageUrl:
            "https://images.stockcake.com/public/1/9/7/197e7e58-c543-43c2-980e-4ab7ae1026fa_large/anime-office-teamwork-stockcake.jpg",
        content: [
            "With the rapid development of digital technology and the increasing popularity of remote work, volunteer activities are gradually adapting to this format. Many non-profit organizations, community projects, and volunteer groups are carrying out tasks online, from fundraising and social advocacy to counseling, training, and event organization. However, balancing remote work in volunteer activities presents unique challenges, requiring both coordinators and volunteers to adjust flexibly to maintain effectiveness and engagement.",
            "One of the biggest challenges is time management. When volunteers work remotely, they often have to juggle their main job or studies, leading to the risk of burnout or wasted time if there isn't a clear schedule. Additionally, the lack of direct interaction can easily create a sense of distance, reducing motivation and engagement with the organization. Communication via email, chat, or video calls is sometimes insufficient to resolve issues, resulting in delays or misunderstandings.",
            "Technology plays a crucial role in supporting the balance of remote work in volunteering. Online volunteer management platforms, team communication apps, and scheduling tools help to assign tasks transparently, track progress, and remind volunteers on time. Adopting online project management systems makes it easy for everyone to update progress, exchange ideas, and report results, while also reducing the burden of administrative management.",
            "To maintain balance, organizations also need to establish flexible regulations regarding participation time, workload, and expectations for volunteers. Regular online meetings, combined with interactive activities, training, and recognition of achievements, also contribute to increased engagement and motivation. At the same time, volunteers need to proactively manage their time, set limits, and use work management tools to ensure a balance between their main job, personal life, and volunteer work.",
            "Balancing remote work in volunteer activities not only optimizes the effectiveness of each project but also enhances the volunteer experience, creating a sustainable and long-term environment for social organizations. When implemented scientifically and flexibly, remote volunteer work ensures both work efficiency and helps participants maintain a balance between responsibility and joy in contributing to the community."
        ],
    },
    {
        id: "3",
        title: "Lan tỏa tinh thần tình nguyện trong cộng đồng",
        author: "Points of Light",
        date: "10/12/2025",
        imageUrl:
            "https://3.files.edl.io/0b2a/24/01/29/162828-0e29dfbb-09a6-4ef3-8535-b86eae10381e.jpeg",
        content: [
            "Volunteerism is one of the core values ​​that helps build a cohesive, humane, and sustainable community. Spreading this spirit doesn't just rely on large-scale media campaigns or events, but also stems from small, regular, and meaningful actions in daily life. When each person contributes their strength, time, or skills to the community, they not only directly benefit those being helped but also create a ripple effect, inspiring those around them.",
            "One important way to spread the spirit of volunteerism is to build a culture of active participation. Organizations, schools, and community groups can organize practical, accessible activities such as cleaning, caring for the elderly, supporting children, or online fundraising campaigns. When these activities are widely shared on social media or through internal communication channels, not only participants but also the community will feel the value of working together, thereby encouraging more people to participate.",
            "Technology also plays a crucial role in spreading the spirit of volunteerism. Online volunteer management platforms, mobile applications, and social networks connect those who want to participate with projects in need of support, while providing transparent information about goals, progress, and results. As a result, participants feel their work is meaningful and can easily share their experiences, creating a domino effect within the community.",
            "Education and awareness campaigns are also crucial. When the spirit of volunteerism is integrated into curricula, extracurricular activities, and community workshops, young people will develop a habit of contributing and understand the importance of helping others. Stories, images, and real-life experiences of volunteering help people feel the value of sharing, thereby motivating them to act.",
            "Spreading the spirit of volunteerism is not just an individual act, but a community movement where every contribution, however small, creates a positive impact. When many people participate, these actions resonate, helping to build a cohesive, compassionate, and vibrant society. Maintaining and continuously developing the spirit of volunteerism will create a solid foundation for community activities, fostering compassion and encouraging everyone to work together for greater good."
        ],
    },
];

const Article: React.FC = () => {
    const { id } = useParams();
    const { t } = useTranslation();
    const article = useMemo(() => {
        return ARTICLES.find((a) => a.id === id) ?? ARTICLES[0];
    }, [id]);

    const titleKey = `home.article.items.${article.id}.title`;
    const paragraphKeyPrefix = `home.article.items.${article.id}.content.`;
    const localizedTitle = t(titleKey, { defaultValue: article.title });
    const localizedParagraphs = article.content.map((p, idx) =>
        t(`${paragraphKeyPrefix}${idx}`, { defaultValue: p })
    );

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded-lg mt-8 text-left">
            <h1 className="text-3xl font-bold mb-2 text-gray-900">{localizedTitle}</h1>
            <p className="text-sm text-gray-500 mb-4">
                {t('home.article.by', { defaultValue: 'By' })} <span className="font-semibold">{article.author}</span> | {article.date}
            </p>

            {article.imageUrl && (
                <img
                    src={article.imageUrl}
                    alt={localizedTitle}
                    className="w-full h-64 object-cover rounded-lg mb-6"
                />
            )}

            <div className="space-y-4 text-gray-700 leading-relaxed">
                {localizedParagraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 text-gray-600">
                <p>{t('home.article.rightsFormat', { year: new Date().getFullYear(), author: article.author, defaultValue: '© {{year}} {{author}}. All rights reserved.' })}</p>
            </div>
        </div>
    );
};

export default Article;