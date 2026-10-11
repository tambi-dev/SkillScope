from __future__ import annotations

import unittest

from skillscope.processing.roles import classify_role, strip_html


class RoleClassificationTests(unittest.TestCase):
    def test_includes_each_target_role_from_title(self) -> None:
        examples = {
            "Аналитик данных по клиентскому опыту": "data_analyst",
            "BI-аналитик": "bi_analyst",
            "Senior Data Scientist": "data_scientist",
            "Machine Learning Engineer": "ml_engineer",
            "Backend Python Developer": "backend_developer",
            "Frontend React Developer": "frontend_developer",
            "Full-stack Developer": "fullstack_developer",
            "Backend / Frontend Developer": "fullstack_developer",
            "DevOps Engineer": "devops_engineer",
            "SOC Analyst": "information_security_specialist",
            "Специалист ИБ": "information_security_specialist",
            "QA Automation Engineer": "qa_engineer",
            "Инженер по тестированию": "qa_engineer",
        }

        for title, expected_role in examples.items():
            with self.subTest(title=title):
                result = classify_role(title)
                self.assertEqual(result.decision, "included")
                self.assertEqual(result.role_family, expected_role)

    def test_excludes_education_false_positive(self) -> None:
        for title in (
            "Методолог образовательных программ (Data Analytics / Data Science)",
            "Python Backend developer (Ментор)",
            "Fullstack developer (mentor)",
        ):
            with self.subTest(title=title):
                result = classify_role(title)
                self.assertEqual(result.decision, "excluded")
                self.assertIn("education_role", result.reason_codes)

    def test_excludes_data_analyst_title_when_description_is_teaching(self) -> None:
        result = classify_role(
            "Data Analyst",
            "Data analytics yo'nalishida dars berish; amaliy loyihalar orqali bilim ulashish.",
        )

        self.assertEqual(result.decision, "excluded")
        self.assertIn("education_role_in_description", result.reason_codes)

    def test_ml_model_training_is_not_an_education_exclusion(self) -> None:
        result = classify_role(
            "Data Scientist",
            "Разработка и обучение моделей машинного обучения.",
        )

        self.assertEqual(result.decision, "included")

    def test_excludes_data_analyst_title_when_description_names_business_role(self) -> None:
        result = classify_role(
            "Аналитик данных",
            "Ищем сильного бизнес-аналитика для управления продажами и запасами.",
        )

        self.assertEqual(result.decision, "excluded")
        self.assertIn("business_analyst_in_description", result.reason_codes)

    def test_excludes_adjacent_analyst_even_with_data_skills(self) -> None:
        result = classify_role("Продуктовый аналитик")

        self.assertEqual(result.decision, "excluded")

    def test_excludes_hybrid_accounting_title(self) -> None:
        result = classify_role("Аналитик данных (Excel) / специалист по учёту")

        self.assertEqual(result.decision, "excluded")
        self.assertIsNone(result.role_family)
        self.assertIn("accounting_role", result.reason_codes)

    def test_includes_core_internship(self) -> None:
        result = classify_role("Стажёр Data Analyst")

        self.assertEqual(result.decision, "included")
        self.assertEqual(result.role_family, "data_analyst")

    def test_assigns_hybrid_data_science_role_to_ml_engineer(self) -> None:
        result = classify_role("Data Scientist / ML Engineer")

        self.assertEqual(result.decision, "included")
        self.assertEqual(result.role_family, "ml_engineer")
        self.assertIn("multiple_core_roles", result.reason_codes)

    def test_includes_common_core_title_variants(self) -> None:
        examples = {
            "Senior ML/AI Engineer": "ml_engineer",
            "BI Developer / Analyst": "bi_analyst",
            "AI/ML Senior Engineer": "ml_engineer",
            "Senior Full-Stack JavaScript Developer": "fullstack_developer",
            "Программист Bitrix Framework / Fullstack веб-разработчик": "fullstack_developer",
            "Инженер по Нагрузочному тестированию": "qa_engineer",
            "QA FullStack Engineer (Manual + Auto)": "qa_engineer",
        }

        for title, expected_role in examples.items():
            with self.subTest(title=title):
                result = classify_role(title)
                self.assertEqual(result.decision, "included")
                self.assertEqual(result.role_family, expected_role)

    def test_excludes_unrelated_title_without_signals(self) -> None:
        result = classify_role("Менеджер по продажам")

        self.assertEqual(result.decision, "excluded")

    def test_strips_html_entities(self) -> None:
        self.assertEqual(strip_html("<p>SQL &amp; Python</p>"), " SQL & Python ")

    def test_excludes_adjacent_security_sales_and_quality_control(self) -> None:
        for title in ("Information Security Sales Specialist", "QA/QC Engineer"):
            with self.subTest(title=title):
                self.assertEqual(classify_role(title).decision, "excluded")

    def test_excludes_design_only_frontend_hybrid(self) -> None:
        result = classify_role(
            "Frontend-разработчик / UI UX",
            "Разработка UI в Figma, создание прототипов и подготовка макетов "
            "для передачи frontend-разработчикам.",
        )
        self.assertEqual(result.decision, "excluded")
        self.assertIn("design_role_in_description", result.reason_codes)

    def test_keeps_frontend_hybrid_with_code_work(self) -> None:
        result = classify_role(
            "Frontend-разработчик / UI UX",
            "Проектировать макеты в Figma и разрабатывать интерфейсы на TypeScript и React.",
        )
        self.assertEqual(result.role_family, "frontend_developer")


if __name__ == "__main__":
    unittest.main()
